import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema';
import {
  QUOTA_FIELDS,
  QuotaChanges,
  QuotaOperation,
  QuotaOperationDocument,
} from './schemas/quota-operation.schema';

const durable = { writeConcern: { w: 'majority' as const } };
export function quotaOperationId(
  userId: string,
  kind: string,
  requestId: string,
) {
  return createHash('sha256')
    .update(JSON.stringify([userId, kind, requestId]))
    .digest('hex');
}

@Injectable()
export class QuotaLedgerService {
  constructor(
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(QuotaOperation.name)
    private readonly operations: Model<QuotaOperationDocument>,
  ) {}

  /**
   * 单个账户文档内同时更新所有权益、单调版本和待归档回执。
   * 回执归档完成前禁止下一笔操作覆盖；其他请求可协助归档。
   * 先读账户快照，再读该笔账务状态，最后用快照版本条件写入。
   * 此顺序不能改为并行：版本会阻止旧 worker 在回执清理后重复应用。
   */
  async apply(
    userId: string,
    kind: string,
    requestId: string,
    changes: QuotaChanges,
  ) {
    return this.applyChanges(userId, kind, requestId, changes, false);
  }

  async reverse(
    userId: string,
    kind: string,
    requestId: string,
    changes: QuotaChanges,
  ) {
    await this.ensureOperation(userId, kind, requestId, changes);
    await this.operations.updateOne(
      { _id: quotaOperationId(userId, kind, requestId), userId },
      {
        $set: { cancelRequested: true },
      },
      durable,
    );
    // 推进账户版本，拦住已读取旧 pending 状态、尚未执行条件扣次的 worker。
    await this.applyChanges(
      userId,
      `${kind}:cancel-barrier`,
      requestId,
      {},
      true,
    );
    const wasApplied = await this.wasApplied(userId, kind, requestId);
    if (wasApplied) {
      const inverse = Object.fromEntries(
        Object.entries(changes).map(([field, amount]) => [field, -amount]),
      );
      await this.apply(userId, `${kind}:refund`, requestId, inverse);
    }
    return { wasApplied };
  }

  private async ensureOperation(
    userId: string,
    kind: string,
    requestId: string,
    changes: QuotaChanges,
  ) {
    const operationId = quotaOperationId(userId, kind, requestId);
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify(
          Object.entries(changes).sort(([a], [b]) => a.localeCompare(b)),
        ),
      )
      .digest('hex');
    try {
      await this.operations.updateOne(
        { _id: operationId },
        {
          $setOnInsert: {
            _id: operationId,
            userId,
            kind,
            requestId,
            changes,
            payloadHash,
            status: 'pending',
          },
        },
        { upsert: true, ...durable },
      );
    } catch (error: unknown) {
      if (
        !(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 11000
        )
      )
        throw error;
    }
    const operation = await this.operations.findById(operationId);
    if (
      !operation ||
      operation.userId !== userId ||
      operation.payloadHash !== payloadHash
    )
      throw new ConflictException('同一请求不能更换权益操作');
    return { operationId, payloadHash };
  }

  private async applyChanges(
    userId: string,
    kind: string,
    requestId: string,
    changes: QuotaChanges,
    barrier: boolean,
  ) {
    const entries = Object.entries(changes).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    if (
      (!barrier && !entries.length) ||
      entries.some(
        ([key, value]) =>
          !QUOTA_FIELDS.includes(key as (typeof QUOTA_FIELDS)[number]) ||
          !Number.isSafeInteger(value) ||
          value === 0,
      )
    ) {
      throw new BadRequestException('权益变更参数无效');
    }
    const { operationId, payloadHash } = await this.ensureOperation(
      userId,
      kind,
      requestId,
      changes,
    );
    for (let attempt = 0; attempt < 12; attempt++) {
      const user = await this.users
        .findById(userId)
        .select('+quotaRevision +quotaReceipt');
      if (!user) throw new NotFoundException('用户不存在');
      if (user.quotaReceipt) {
        await this.archiveReceipt(
          userId,
          user.quotaRevision ?? 0,
          user.quotaReceipt,
        );
        continue;
      }
      // 必须在账户快照之后读取，避免已归档旧请求用新版本再次扣次。
      const operation = await this.operations.findById(operationId);
      if (
        !operation ||
        operation.userId !== userId ||
        operation.payloadHash !== payloadHash
      ) {
        throw new ConflictException('同一请求不能更换权益操作');
      }
      if (operation.status === 'applied')
        return { operationId, appliedAt: operation.appliedAt };
      if (operation.cancelRequested)
        throw new ConflictException('本次权益操作已取消');
      const revision = user.quotaRevision ?? 0;
      if (
        !Number.isSafeInteger(revision) ||
        revision < 0 ||
        revision >= Number.MAX_SAFE_INTEGER
      ) {
        throw new ServiceUnavailableException('权益账户需要维护，请联系支持');
      }
      for (const [field, amount] of entries) {
        const balance = user.get(field) as unknown;
        if (typeof balance !== 'number' || !Number.isFinite(balance))
          throw new ServiceUnavailableException('权益余额无效');
        if (balance + amount < 0)
          throw new BadRequestException('权益或小麦币余额不足，本次未扣减');
      }
      const floors = Object.fromEntries(
        entries
          .filter(([, value]) => value < 0)
          .map(([key, value]) => [key, { $gte: -value }]),
      );
      const receipt = { operationId, appliedAt: new Date() };
      const applied = await this.users.findOneAndUpdate(
        {
          _id: userId,
          quotaReceipt: { $exists: false },
          ...floors,
          $or: [
            { quotaRevision: revision },
            ...(revision === 0 ? [{ quotaRevision: { $exists: false } }] : []),
          ],
        },
        {
          $inc: { ...changes, quotaRevision: 1 },
          $set: { quotaReceipt: receipt },
        },
        { new: true, ...durable },
      );
      if (!applied) continue;
      await this.archiveReceipt(userId, revision + 1, receipt);
      return { operationId, appliedAt: receipt.appliedAt };
    }
    throw new ServiceUnavailableException(
      '权益账户正在处理其他操作，请使用同一请求重试',
    );
  }

  async wasApplied(userId: string, kind: string, requestId: string) {
    const user = await this.users
      .findById(userId)
      .select('+quotaRevision +quotaReceipt');
    if (!user) throw new NotFoundException('用户不存在');
    if (user.quotaReceipt)
      await this.archiveReceipt(
        userId,
        user.quotaRevision ?? 0,
        user.quotaReceipt,
      );
    const operation = await this.operations.findOne({
      _id: quotaOperationId(userId, kind, requestId),
      userId,
    });
    return operation?.status === 'applied';
  }

  private async archiveReceipt(
    userId: string,
    revision: number,
    receipt: NonNullable<User['quotaReceipt']>,
  ) {
    const archived = await this.operations.findOneAndUpdate(
      { _id: receipt.operationId, userId },
      {
        $set: { status: 'applied', appliedAt: receipt.appliedAt },
      },
      { new: true, ...durable },
    );
    if (!archived)
      throw new ServiceUnavailableException('权益回执尚未归档，请稍后重试');
    await this.users.updateOne(
      {
        _id: userId,
        quotaRevision: revision,
        'quotaReceipt.operationId': receipt.operationId,
      },
      {
        $unset: { quotaReceipt: 1 },
      },
      durable,
    );
  }
}
