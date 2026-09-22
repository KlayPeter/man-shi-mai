import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PaymentService } from '../../src/payment/payment.service';
import {
  PaymentRecord,
  PaymentRecordStatus,
} from '../../src/payment/payment-record.schema';
import { User } from '../../src/user/schemas/user.schema';
import { UserTransaction } from '../../src/user/schemas/user-transaction.schema';
import { PaymentChannel } from '../../src/payment/payment.types';
import { resolvePaymentPlan } from '../../src/payment/payment-plans';

function query(value: unknown) {
  return {
    exec: jest.fn().mockResolvedValue(value),
    lean: jest.fn().mockResolvedValue(value),
    select: jest.fn().mockReturnThis(),
  };
}

describe('PaymentService 安全与恢复', () => {
  let service: PaymentService;
  const owner = { userId: '507f1f77bcf86cd799439011' };
  const order = {
    orderId: '00000000-0000-4000-8000-000000000001',
    userId: owner.userId,
    channel: PaymentChannel.VIRTUAL,
    amount: 18.8,
    currency: 'CNY',
    planId: 'single',
    status: PaymentRecordStatus.PENDING,
    metadata: { provider: 'virtual', version: 1 },
  };
  const dto = {
    planId: 'single',
    amount: 18.8,
    planName: '客户端伪造名称',
    description: '测试',
    source: 'web',
    channel: PaymentChannel.VIRTUAL,
    metadata: { benefits: { maiCoinBalance: 99999 } },
  };
  const records = {
    create: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };
  const users = { findById: jest.fn(), findOneAndUpdate: jest.fn() };
  const transactions = { findOneAndUpdate: jest.fn(), findOne: jest.fn() };
  let settings: Record<string, string>;

  beforeEach(async () => {
    jest.resetAllMocks();
    settings = { NODE_ENV: 'test', PAYMENT_MODE: 'virtual' };
    records.create.mockResolvedValue(order);
    records.findOne.mockReturnValue(query(order));
    records.findOneAndUpdate.mockReturnValue(query(order));
    records.updateOne.mockReturnValue(query({ modifiedCount: 1 }));
    users.findById.mockReturnValue(
      query({ _id: owner.userId, specialRemainingCount: 1 }),
    );
    users.findOneAndUpdate.mockReturnValue(query({ _id: owner.userId }));
    transactions.findOneAndUpdate.mockReturnValue(
      query({ relatedOrderId: order.orderId }),
    );
    const module = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: getModelToken(PaymentRecord.name), useValue: records },
        { provide: getModelToken(User.name), useValue: users },
        {
          provide: getModelToken(UserTransaction.name),
          useValue: transactions,
        },
        {
          provide: ConfigService,
          useValue: { get: (key: string) => settings[key] },
        },
      ],
    }).compile();
    service = module.get(PaymentService);
  });

  it.each(['production', 'staging'])(
    '环境 %s 即使开启 virtual 也不能发放',
    async (environment) => {
      settings.NODE_ENV = environment;
      expect(service.getCapabilities().enabled).toBe(false);
      await expect(service.initiatePayment(dto, owner)).rejects.toThrow(
        ServiceUnavailableException,
      );
      await expect(
        service.mockPaymentSuccess(order.orderId, owner),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(users.findOneAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('默认关闭，并且查询待支付订单不写任何权益', async () => {
    delete settings.PAYMENT_MODE;
    expect(service.getCapabilities().mode).toBe('disabled');
    expect(
      await service.queryAlipayPaymentStatus(order.orderId, owner),
    ).toMatchObject({ status: 'pending', success: false });
    expect(records.findOneAndUpdate).not.toHaveBeenCalled();
    expect(users.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('仅存储服务端套餐规则，不信任客户端名称或权益', async () => {
    const result = await service.initiatePayment(dto, owner);
    expect(result.channel).toBe('virtual');
    expect(records.create).toHaveBeenCalledWith(
      expect.objectContaining({
        planName: '单次练习',
        metadata: expect.objectContaining({
          benefits: { specialRemainingCount: 1 },
          version: 1,
        }),
      }),
    );
  });

  it('拒绝改价、真实通道以及分数或越界的小麦币数量', async () => {
    await expect(
      service.initiatePayment({ ...dto, amount: 1 }, owner),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.initiatePayment(
        { ...dto, channel: PaymentChannel.ALIPAY },
        owner,
      ),
    ).rejects.toThrow(BadRequestException);
    for (const amount of [0, 1.2, 10001, NaN])
      expect(() => resolvePaymentPlan('custom', amount)).toThrow(
        BadRequestException,
      );
  });

  it('拒绝读取或模拟他人订单，缺失订单返回 404', async () => {
    await expect(
      service.mockPaymentSuccess(order.orderId, { userId: 'other' }),
    ).rejects.toThrow(ForbiddenException);
    await expect(
      service.queryAlipayPaymentStatus(order.orderId, { userId: 'other' }),
    ).rejects.toThrow(ForbiddenException);
    records.findOne.mockReturnValue(query(null));
    await expect(
      service.queryAlipayPaymentStatus(order.orderId, owner),
    ).rejects.toThrow(NotFoundException);
  });

  it('旧 alipay 模拟订单不能再次确认发放', async () => {
    records.findOne.mockReturnValue(
      query({ ...order, channel: PaymentChannel.ALIPAY }),
    );
    await expect(
      service.mockPaymentSuccess(order.orderId, owner),
    ).rejects.toThrow(BadRequestException);
    expect(users.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('正在处理且未过期的订单仅返回状态，不再次发放', async () => {
    records.findOne.mockReturnValue(query({ ...order, status: 'processing' }));
    records.findOneAndUpdate.mockReturnValueOnce(query(null));
    expect(
      await service.mockPaymentSuccess(order.orderId, owner),
    ).toMatchObject({ success: false, status: 'processing' });
    expect(users.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('流水写入失败后允许同单恢复；已有回执不会重复增加权益', async () => {
    transactions.findOneAndUpdate.mockReturnValueOnce({
      exec: jest.fn().mockRejectedValue(new Error('ledger unavailable')),
    });
    await expect(
      service.mockPaymentSuccess(order.orderId, owner),
    ).rejects.toThrow('ledger unavailable');
    expect(records.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: order.orderId,
        processingToken: expect.any(String),
      }),
      expect.objectContaining({ $set: { status: 'pending' } }),
    );
    users.findOneAndUpdate.mockReturnValue(query(null));
    users.findById.mockReturnValue(
      query({
        virtualPaymentOrderId: order.orderId,
        hasUsedVirtualPayment: true,
      }),
    );
    expect(
      await service.mockPaymentSuccess(order.orderId, owner),
    ).toMatchObject({ success: true });
    expect(users.findOneAndUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        virtualPaymentOrderId: { $exists: false },
        hasUsedVirtualPayment: { $ne: true },
      }),
      expect.objectContaining({
        $inc: { specialRemainingCount: 1 },
        $set: {
          hasUsedVirtualPayment: true,
          virtualPaymentOrderId: order.orderId,
        },
      }),
      { new: true },
    );
    expect(transactions.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('其他订单已经使用模拟权益时拒绝，不能利用并发订单绕过限制', async () => {
    users.findOneAndUpdate.mockReturnValue(query(null));
    users.findById.mockReturnValue(
      query({
        virtualPaymentOrderId: 'different-order',
        hasUsedVirtualPayment: true,
      }),
    );
    await expect(
      service.mockPaymentSuccess(order.orderId, owner),
    ).rejects.toThrow(ForbiddenException);
    expect(transactions.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('成功订单重复确认不写账，并从响应中排除密码与内部回执', async () => {
    records.findOne.mockReturnValue(query({ ...order, status: 'success' }));
    const responseQuery = query({ specialRemainingCount: 1 });
    users.findById.mockReturnValue(responseQuery);
    expect(
      await service.mockPaymentSuccess(order.orderId, owner),
    ).toMatchObject({ success: true, user: { specialRemainingCount: 1 } });
    expect(responseQuery.select).toHaveBeenCalledWith(
      '-password -virtualPaymentOrderId',
    );
    expect(users.findOneAndUpdate).not.toHaveBeenCalled();
    expect(transactions.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
