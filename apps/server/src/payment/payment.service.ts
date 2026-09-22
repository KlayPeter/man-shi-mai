import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { PaymentInitiationResult, PaymentChannel } from './payment.types';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import {
  PaymentRecord,
  PaymentRecordDocument,
  PaymentRecordStatus,
} from './payment-record.schema';
import { User, UserDocument } from '../user/schemas/user.schema';
import {
  UserTransaction,
  UserTransactionDocument,
  UserTransactionType,
} from '../user/schemas/user-transaction.schema';
import {
  PAYMENT_PLANS,
  resolvePaymentPlan,
  BenefitField,
} from './payment-plans';

export type PaymentRecordContext = {
  /** 业务系统中的用户唯一标识 */
  userId: string;

  /** 买家登录账号（支付宝侧返回的脱敏账号，如手机号或邮箱） */
  buyerLogonId: string;

  /** 买家实际支付金额 */
  buyerPayAmount: string;

  /** 可开票金额 */
  invoiceAmount: string;

  /** 商户系统生成的订单号（商户侧唯一） */
  outTradeNo: string;

  /**
   * 透传参数（passback_params）
   * - 支付发起时由商户传入
   * - 支付完成后由支付宝原样回传
   * - 通常是 URL 编码后的 JSON 字符串
   */
  passbackParams: string;

  /** 使用积分抵扣的金额 */
  pointAmount: string;

  /** 实际到账金额（扣除手续费后的金额） */
  receiptAmount: string;

  /** 订单总金额 */
  totalAmount: string;

  /** 支付宝侧生成的交易号（平台侧唯一） */
  tradeNo: string;

  /**
   * 交易状态
   * - WAIT_BUYER_PAY：等待买家支付
   * - TRADE_SUCCESS：支付成功
   * - TRADE_FAIL：支付失败
   * - 其他字符串：兼容支付宝未来可能新增的状态
   */
  tradeStatus: 'WAIT_BUYER_PAY' | 'TRADE_SUCCESS' | 'TRADE_FAIL' | string;

  /** 买家在当前应用下的 OpenId（小程序 / 公众号场景常见） */
  buyerOpenId: string;

  /** 链路追踪 ID，用于分布式系统日志与问题定位 */
  traceId: string;

  /**
   * 解析后的业务元数据
   * - 通常由 passbackParams 反序列化得到
   * - 存放业务自定义字段，如 planId、source、场景标识等
   */
  metadata?: Record<string, unknown>;

  /** 支付渠道标识，如：alipay / wechat / stripe 等 */
  channel: string;

  /** 实际支付完成时间 */
  paidAt: Date;

  /** 币种，如：CNY / USD */
  currency: string;
};

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  constructor(
    @InjectModel(PaymentRecord.name)
    private readonly paymentRecordModel: Model<PaymentRecordDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserTransaction.name)
    private readonly userTransactionModel: Model<UserTransactionDocument>,
    private readonly config: ConfigService,
  ) {}

  getCapabilities() {
    const enabled =
      ['development', 'test'].includes(
        this.config.get<string>('NODE_ENV') || 'development',
      ) && this.config.get<string>('PAYMENT_MODE') === 'virtual';
    return {
      enabled,
      mode: enabled ? 'virtual' : 'disabled',
      plans: PAYMENT_PLANS,
      message: enabled
        ? '测试环境：模拟发放不产生真实交易，每个账户限一次'
        : '充值暂未开放，已有练习权益可继续使用',
    };
  }

  private assertVirtualEnabled() {
    if (!this.getCapabilities().enabled)
      throw new ServiceUnavailableException('充值暂未开放');
  }

  async initiatePayment(
    dto: InitiatePaymentDto,
    user?: { userId?: string },
  ): Promise<PaymentInitiationResult> {
    this.assertVirtualEnabled();
    if (!user?.userId || !Types.ObjectId.isValid(user.userId))
      throw new ForbiddenException('请先登录');
    if (dto.channel !== PaymentChannel.VIRTUAL)
      throw new BadRequestException('当前仅支持测试模拟发放');
    const plan = resolvePaymentPlan(dto.planId, dto.amount);
    if (dto.currency && dto.currency !== 'CNY')
      throw new BadRequestException('暂不支持该币种');
    const currentUser = await this.userModel.findById(user.userId).lean();
    if (!currentUser) throw new NotFoundException('用户不存在');
    if (currentUser.hasUsedVirtualPayment)
      throw new ForbiddenException('该账户已使用过模拟发放');
    const orderId = uuidv4();
    const createdAt = new Date();
    await this.paymentRecordModel.create({
      orderId,
      userId: user.userId,
      user: new Types.ObjectId(user.userId),
      channel: PaymentChannel.VIRTUAL,
      amount: plan.price,
      currency: 'CNY',
      planId: plan.id,
      planName: plan.name,
      source: dto.source,
      description: `模拟发放：${plan.name}`,
      status: PaymentRecordStatus.PENDING,
      metadata: {
        planId: plan.id,
        amount: plan.price,
        benefits: plan.benefits,
        provider: 'virtual',
        version: 1,
      },
      createdAt,
    });
    return {
      channel: PaymentChannel.VIRTUAL,
      orderId,
      createdAt: createdAt.toISOString(),
    };
  }

  private async ownedOrder(orderId: string, userId: string) {
    const record = await this.paymentRecordModel.findOne({ orderId }).exec();
    if (!record) throw new NotFoundException('订单不存在');
    if (record.userId !== userId)
      throw new ForbiddenException('无权访问此订单');
    return record;
  }

  // 查询只读取持久化状态，不能把模拟网关的查询当作支付凭证。
  async queryAlipayPaymentStatus(orderId: string, user: { userId: string }) {
    const record = await this.ownedOrder(orderId, user.userId);
    return {
      orderId,
      status: record.status,
      success: record.status === PaymentRecordStatus.SUCCESS,
      channel: record.channel,
    };
  }

  async mockPaymentSuccess(orderId: string, user: { userId: string }) {
    this.assertVirtualEnabled();
    const record = await this.ownedOrder(orderId, user.userId);
    if (
      record.channel !== PaymentChannel.VIRTUAL ||
      record.metadata?.provider !== 'virtual' ||
      record.metadata?.version !== 1
    ) {
      throw new BadRequestException(
        '此订单不能用于模拟发放，请在测试环境重新创建',
      );
    }
    // 权益基于已保存订单与服务端目录，不使用调用者传入的 metadata 或金额。
    const plan = resolvePaymentPlan(record.planId || '', record.amount);
    if (record.currency !== 'CNY')
      throw new BadRequestException('订单币种无效');
    if (record.status !== PaymentRecordStatus.SUCCESS) {
      const processingToken = uuidv4();
      const now = new Date();
      const claimed = await this.paymentRecordModel
        .findOneAndUpdate(
          {
            orderId,
            userId: user.userId,
            $or: [
              { status: PaymentRecordStatus.PENDING },
              {
                status: PaymentRecordStatus.PROCESSING,
                processingExpiresAt: { $lte: now },
              },
            ],
          },
          {
            $set: {
              status: PaymentRecordStatus.PROCESSING,
              processingToken,
              processingAt: now,
              processingExpiresAt: new Date(now.getTime() + 60_000),
            },
          },
          { new: true },
        )
        .exec();
      if (!claimed) return this.queryAlipayPaymentStatus(orderId, user);
      try {
        // 发放和回执在用户文档中一起写入。即使后面的流水失败，重试也不会再增加权益。
        const granted = await this.userModel
          .findOneAndUpdate(
            {
              _id: user.userId,
              hasUsedVirtualPayment: { $ne: true },
              virtualPaymentOrderId: { $exists: false },
            },
            {
              $inc: plan.benefits,
              $set: {
                hasUsedVirtualPayment: true,
                virtualPaymentOrderId: orderId,
              },
            },
            { new: true },
          )
          .exec();
        if (!granted) {
          const existing = await this.userModel
            .findById(user.userId)
            .select('+virtualPaymentOrderId')
            .lean();
          if (!existing) throw new NotFoundException('用户不存在');
          if (existing.virtualPaymentOrderId !== orderId)
            throw new ForbiddenException('该账户已使用过模拟发放');
        }
        await this.ensureTransaction(record, plan.name, plan.benefits);
        const finished = await this.paymentRecordModel
          .findOneAndUpdate(
            { orderId, processingToken },
            {
              $set: { status: PaymentRecordStatus.SUCCESS, paidAt: now },
              $unset: { processingToken: 1, processingExpiresAt: 1 },
            },
            { new: true },
          )
          .exec();
        if (!finished) return this.queryAlipayPaymentStatus(orderId, user);
      } catch (error: unknown) {
        await this.paymentRecordModel
          .updateOne(
            { orderId, processingToken },
            {
              $set: { status: PaymentRecordStatus.PENDING },
              $unset: { processingToken: 1, processingExpiresAt: 1 },
            },
          )
          .exec();
        this.logger.error(
          `模拟订单处理未完成，允许同单恢复: orderId=${orderId}`,
        );
        throw error;
      }
    }
    const updatedUser = await this.userModel
      .findById(user.userId)
      .select('-password -virtualPaymentOrderId')
      .lean();
    if (!updatedUser) throw new NotFoundException('用户不存在');
    return {
      success: true,
      status: PaymentRecordStatus.SUCCESS,
      orderId,
      user: updatedUser,
    };
  }

  private async ensureTransaction(
    record: PaymentRecordDocument,
    name: string,
    benefits: Partial<Record<BenefitField, number>>,
  ) {
    try {
      await this.userTransactionModel
        .findOneAndUpdate(
          { relatedOrderId: record.orderId },
          {
            $setOnInsert: {
              user: record.user,
              userIdentifier: record.userId,
              type: UserTransactionType.RECHARGE,
              amount: record.amount,
              currency: 'CNY',
              description: `测试模拟发放：${name}（未产生真实交易）`,
              planId: record.planId,
              planName: name,
              relatedOrderId: record.orderId,
              source: 'virtual',
              metadata: { simulated: true, benefits },
              createdAt: new Date(),
            },
          },
          { upsert: true, new: true },
        )
        .exec();
    } catch (error: unknown) {
      // 唯一索引抢占失败意味着同一订单已有流水，其他数据库故障仍需恢复。
      if (
        !(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 11000
        )
      )
        throw error;
      const existing = await this.userTransactionModel
        .findOne({
          relatedOrderId: record.orderId,
          userIdentifier: record.userId,
        })
        .lean();
      if (!existing || existing.amount !== record.amount) throw error;
    }
  }
}
