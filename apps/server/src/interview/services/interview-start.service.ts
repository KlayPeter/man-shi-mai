import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { Subject } from 'rxjs';
import {
  QuotaLedgerService,
  quotaOperationId,
} from '../../user/quota-ledger.service';
import { QuotaChanges } from '../../user/schemas/quota-operation.schema';
import {
  StartMockInterviewDto,
  MockInterviewEventDto,
  MockInterviewEventType as Event,
} from '../dto/mock-interview.dto';
import {
  AIInterviewResult,
  AIInterviewResultDocument,
} from '../schemas/ai-interview-result.schema';
import {
  ConsumptionRecord,
  ConsumptionRecordDocument,
  ConsumptionStatus,
  ConsumptionType,
} from '../schemas/consumption-record.schema';
import { InterviewAIService } from './interview-ai.service';
import { interviewSession, InterviewSession } from './interview-session';

const durable = { writeConcern: { w: 'majority' as const } };
const openLease = () => ({
  $or: [
    { startLeaseToken: { $exists: false } },
    { startLeaseExpiresAt: { $lte: new Date() } },
  ],
});

@Injectable()
export class InterviewStartService {
  constructor(
    @InjectModel(AIInterviewResult.name)
    private readonly results: Model<AIInterviewResultDocument>,
    @InjectModel(ConsumptionRecord.name)
    private readonly consumption: Model<ConsumptionRecordDocument>,
    private readonly quota: QuotaLedgerService,
    private readonly ai: InterviewAIService,
  ) {}

  start(
    userId: string,
    dto: StartMockInterviewDto,
    resolveResume: () => Promise<string>,
  ) {
    const events = new Subject<MockInterviewEventDto>();
    void Promise.resolve()
      .then(() => this.execute(userId, dto, resolveResume, events))
      .catch((error: unknown) => {
        events.next({
          type: Event.ERROR,
          requestId: dto.requestId,
          error:
            error instanceof HttpException
              ? error.message
              : '开场尚未确认，请重试同一次开始或取消开始',
        });
        events.complete();
      });
    return events;
  }

  private key(userId: string, requestId: string) {
    return quotaOperationId(userId, 'mock-start', requestId);
  }
  private changes(record: AIInterviewResultDocument): QuotaChanges {
    return record.interviewType === 'special'
      ? { specialRemainingCount: -1 }
      : { behaviorRemainingCount: -1 };
  }

  private async ensureRecord(userId: string, dto: StartMockInterviewDto) {
    const resultId = this.key(userId, dto.requestId);
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify([
          dto.interviewType,
          dto.company || '',
          dto.positionName || '',
          dto.candidateName || '',
          dto.minSalary ?? null,
          dto.maxSalary ?? null,
          dto.jd || '',
          dto.resumeId || '',
          dto.resumeContent || '',
        ]),
      )
      .digest('hex');
    if (!dto.positionName?.trim())
      throw new BadRequestException('请选择目标岗位');
    const session: InterviewSession = {
      sessionId: randomUUID(),
      resultId,
      consumptionRecordId: resultId,
      userId,
      interviewType: dto.interviewType,
      interviewerName: '麦麦',
      candidateName: dto.candidateName,
      company: dto.company || '',
      positionName: dto.positionName,
      jd: dto.jd,
      salaryRange:
        dto.minSalary != null && dto.maxSalary != null
          ? `${dto.minSalary}K-${dto.maxSalary}K`
          : undefined,
      resumeContent: '',
      conversationHistory: [],
      questionCount: 0,
      startTime: new Date(),
      targetDuration: 120,
      isActive: true,
    };
    try {
      await this.results.updateOne(
        { resultId },
        {
          $setOnInsert: {
            resultId,
            userId,
            user: new Types.ObjectId(userId),
            interviewType: dto.interviewType,
            company: dto.company || '',
            position: dto.positionName,
            salaryRange: session.salaryRange,
            jobDescription: dto.jd,
            interviewMode: 'text',
            qaList: [],
            totalQuestions: 0,
            answeredQuestions: 0,
            status: 'in_progress',
            sessionState: session,
            consumptionRecordId: resultId,
            startRequestId: dto.requestId,
            startPayloadHash: payloadHash,
            startStatus: 'prepared',
            startPrepared: false,
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
    const record = await this.results.findOne({ resultId, userId });
    if (!record || record.startPayloadHash !== payloadHash)
      throw new ConflictException(
        '同一次开始不能更换岗位或简历，请先取消后重新准备',
      );
    return record;
  }

  private async execute(
    userId: string,
    dto: StartMockInterviewDto,
    resolveResume: () => Promise<string>,
    events: Subject<MockInterviewEventDto>,
  ) {
    let record = await this.ensureRecord(userId, dto);
    const resultId = record.resultId;
    if (record.startStatus === 'refunding') {
      await this.finishCancellation(record);
      record = (await this.results.findOne({ resultId, userId }))!;
    }
    if (record.startStatus === 'cancelled') {
      events.next({
        type: Event.ERROR,
        resultId,
        requestId: dto.requestId,
        startStatus: 'cancelled',
        error: '本次开始已取消，权益已核对。可以重新开始。',
      });
      events.complete();
      return;
    }
    if (record.startStatus === 'ready') {
      await this.replay(record, events);
      return;
    }
    const token = randomUUID();
    const claimed = await this.results.findOneAndUpdate(
      { resultId, userId, startStatus: 'prepared', ...openLease() },
      {
        $set: {
          startLeaseToken: token,
          startLeaseExpiresAt: new Date(Date.now() + 120_000),
        },
      },
      { new: true, ...durable },
    );
    if (!claimed)
      throw new ConflictException('本次开场正在准备，请稍后重试同一请求');
    record = claimed;
    const fence = {
      resultId,
      userId,
      startStatus: 'prepared',
      startLeaseToken: token,
    };
    events.next({
      type: Event.START,
      resultId,
      requestId: dto.requestId,
      sessionId: this.session(record).sessionId,
      startStatus: 'prepared',
      isStreaming: true,
    });
    try {
      let snapshot = this.session(record);
      if (!record.startPrepared) {
        const resumeContent = await resolveResume();
        // 现有开场本来就是本地模板，不调用付费模型，也不再模拟逐字网络延时。
        const opening = this.ai
          .generateOpeningStatement(
            snapshot.interviewerName,
            dto.candidateName,
            dto.positionName,
          )
          .trim();
        if (!opening || opening.length > 20000)
          throw new ServiceUnavailableException('开场内容无效，本次未扣次');
        snapshot.resumeContent = resumeContent;
        snapshot.conversationHistory = [
          { role: 'interviewer', content: opening, timestamp: new Date() },
        ];
        const prepared = await this.results.findOneAndUpdate(
          { ...fence, startLeaseExpiresAt: { $gt: new Date() } },
          {
            $set: {
              startPrepared: true,
              sessionState: snapshot,
              qaList: [{ question: opening, answer: '', askedAt: new Date() }],
            },
          },
          { new: true, ...durable },
        );
        if (!prepared)
          throw new ConflictException('开场准备状态已变化，请重试');
        record = prepared;
      }
      await this.quota.apply(
        userId,
        'mock-start',
        dto.requestId,
        this.changes(record),
      );
      snapshot = this.session(record);
      const now = new Date();
      snapshot.startTime = now;
      snapshot.conversationHistory[0].timestamp = now;
      const ready = await this.results.findOneAndUpdate(
        { ...fence, startLeaseExpiresAt: { $gt: new Date() } },
        {
          $set: {
            startStatus: 'ready',
            sessionState: snapshot,
            'qaList.0.askedAt': now,
            totalQuestions: 1,
          },
          $unset: { startLeaseToken: 1, startLeaseExpiresAt: 1 },
        },
        { new: true, ...durable },
      );
      if (!ready)
        throw new ConflictException('开场状态已更新，请重试确认；不会重复扣次');
      await this.replay(ready, events);
    } catch (error) {
      // 模糊的数据库失败不能直接退款。回执仍在 Mongo，重试会补齐，取消会幂等退还。
      await this.results.updateOne(
        { ...fence },
        { $unset: { startLeaseToken: 1, startLeaseExpiresAt: 1 } },
        durable,
      );
      throw error;
    }
  }

  private session(record: AIInterviewResultDocument) {
    const parsed = interviewSession.safeParse(record.sessionState);
    if (
      !parsed.success ||
      parsed.data.userId !== record.userId ||
      parsed.data.resultId !== record.resultId
    )
      throw new ConflictException('开场会话数据不完整，请联系支持');
    return parsed.data;
  }

  private async replay(
    record: AIInterviewResultDocument,
    events: Subject<MockInterviewEventDto>,
  ) {
    const session = this.session(record);
    const version = record.turnVersion || session.questionCount;
    await this.consumption.updateOne(
      { recordId: record.resultId },
      {
        $set: {
          userId: record.userId,
          user: new Types.ObjectId(record.userId),
          resultId: record.resultId,
          requestId: record.startRequestId,
          type:
            record.interviewType === 'special'
              ? ConsumptionType.SPECIAL_INTERVIEW
              : ConsumptionType.BEHAVIOR_INTERVIEW,
          status: ConsumptionStatus.SUCCESS,
          consumedCount: 1,
          isRefunded: false,
          description: `模拟面试 - ${record.position || '目标岗位'}`,
          startedAt: session.startTime,
          completedAt: session.startTime,
          outputData: {
            resultId: record.resultId,
            sessionId: session.sessionId,
          },
        },
      },
      { upsert: true, ...durable },
    );
    events.next({
      type: Event.START,
      resultId: record.resultId,
      sessionId: session.sessionId,
      requestId: record.startRequestId,
      startStatus: 'ready',
      status: record.status,
      interviewerName: session.interviewerName,
      questionVersion: version,
      isStreaming: false,
      content: session.conversationHistory.at(-1)?.content,
      conversationHistory: session.conversationHistory.map(
        ({ role, content, timestamp }) => ({ role, content, timestamp }),
      ),
    });
    events.next({
      type: record.status === 'completed' ? Event.END : Event.WAITING,
      resultId: record.resultId,
      sessionId: session.sessionId,
      requestId: record.startRequestId,
      questionVersion: version,
      startStatus: 'ready',
      status: record.status,
    });
    events.complete();
  }

  async cancel(userId: string, dto: StartMockInterviewDto) {
    return this.cancelRecord(await this.ensureRecord(userId, dto));
  }

  /** 仅按归属查询已有场次，不需要浏览器保留简历或原始请求。 */
  async cancelResult(userId: string, resultId: string) {
    const record = await this.results.findOne({ userId, resultId });
    if (!record) throw new NotFoundException('面试记录不存在');
    if (!record.startStatus || !record.startRequestId)
      throw new ConflictException('该记录不属于可取消的开场，请通过面试室处理');
    return this.cancelRecord(record);
  }

  private async cancelRecord(record: AIInterviewResultDocument) {
    const { userId, resultId } = record;
    if (record.startStatus === 'ready') return { status: 'ready', resultId };
    if (record.startStatus === 'cancelled')
      return { status: 'cancelled', resultId };
    if (record.startStatus === 'prepared') {
      const claimed = await this.results.findOneAndUpdate(
        { resultId, userId, startStatus: 'prepared', ...openLease() },
        {
          $set: { startStatus: 'refunding' },
          $unset: { startLeaseToken: 1, startLeaseExpiresAt: 1 },
        },
        { new: true, ...durable },
      );
      if (!claimed) throw new ConflictException('开场仍在处理中，请稍后再取消');
      record = claimed;
    }
    await this.finishCancellation(record);
    return { status: 'cancelled', resultId };
  }

  private async finishCancellation(record: AIInterviewResultDocument) {
    if (!record.startRequestId) throw new ConflictException('缺少开始请求标识');
    const { wasApplied } = await this.quota.reverse(
      record.userId,
      'mock-start',
      record.startRequestId,
      this.changes(record),
    );
    await this.consumption.updateOne(
      { recordId: record.resultId },
      {
        $set: {
          userId: record.userId,
          user: new Types.ObjectId(record.userId),
          resultId: record.resultId,
          type:
            record.interviewType === 'special'
              ? ConsumptionType.SPECIAL_INTERVIEW
              : ConsumptionType.BEHAVIOR_INTERVIEW,
          status: ConsumptionStatus.CANCELLED,
          consumedCount: 0,
          isRefunded: wasApplied,
          ...(wasApplied ? { refundedAt: new Date() } : {}),
          description: '取消面试开场',
          completedAt: new Date(),
        },
      },
      { upsert: true, ...durable },
    );
    await this.results.updateOne(
      {
        resultId: record.resultId,
        userId: record.userId,
        startStatus: 'refunding',
      },
      {
        $set: {
          startStatus: 'cancelled',
          status: 'abandoned',
          'sessionState.isActive': false,
        },
      },
      durable,
    );
  }
}
