import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { Model } from 'mongoose';
import { Subject } from 'rxjs';
import {
  AnswerMockInterviewDto,
  MockInterviewEventDto,
  MockInterviewEventType as Event,
} from '../dto/mock-interview.dto';
import {
  AIInterviewResult,
  AIInterviewResultDocument,
  InterviewQA,
} from '../schemas/ai-interview-result.schema';
import { InterviewAgentService } from './interview-agent.service';
import {
  generatedTurn,
  interviewSession,
  InterviewSession,
} from './interview-session';

const LEASE_MS = 120_000;
const GENERATION_MS = 90_000;
const availableLease = () => ({
  $or: [
    { turnLeaseToken: { $exists: false } },
    { turnLeaseExpiresAt: { $lte: new Date() } },
  ],
});

@Injectable()
export class InterviewTurnService {
  private readonly logger = new Logger(InterviewTurnService.name);
  constructor(
    @InjectModel(AIInterviewResult.name)
    private readonly results: Model<AIInterviewResultDocument>,
    private readonly agent: InterviewAgentService,
  ) {}

  answer(
    userId: string,
    dto: AnswerMockInterviewDto,
  ): Subject<MockInterviewEventDto> {
    const events = new Subject<MockInterviewEventDto>();
    // Keep subscription installation ahead of validation/replay errors.
    void Promise.resolve()
      .then(() => this.execute(userId, dto, events))
      .catch((error: unknown) => {
        this.logger.warn(
          `Answer failed: ${error instanceof HttpException ? error.getStatus() : 'internal'}`,
        );
        events.next({
          type: Event.ERROR,
          requestId: dto.requestId,
          error:
            error instanceof HttpException
              ? error.message
              : '回答处理失败，草稿已保留，请重试',
        });
        events.complete();
      });
    return events;
  }

  private session(record: AIInterviewResultDocument): InterviewSession {
    const parsed = interviewSession.safeParse(record.sessionState);
    if (
      !parsed.success ||
      parsed.data.userId !== record.userId ||
      parsed.data.resultId !== record.resultId
    ) {
      throw new ConflictException('会话数据不完整，请保留草稿并联系支持');
    }
    return parsed.data;
  }

  private version(
    record: AIInterviewResultDocument,
    session: InterviewSession,
  ) {
    // 旧记录缺少 turnVersion 时，以已持久化的题目计数建立首个版本。
    return Math.max(record.turnVersion || 0, session.questionCount);
  }

  private versionFilter(version: number) {
    return {
      $or: [{ turnVersion: version }, { turnVersion: { $exists: false } }],
    };
  }

  private async execute(
    userId: string,
    dto: AnswerMockInterviewDto,
    events: Subject<MockInterviewEventDto>,
  ) {
    if (!dto.answer.trim()) throw new BadRequestException('回答不能为空');
    const record = await this.results.findOne({
      userId,
      'sessionState.sessionId': dto.sessionId,
    });
    if (!record) throw new NotFoundException('面试记录不存在');
    if (record.startStatus && record.startStatus !== 'ready')
      throw new ConflictException('开场尚未完成，请重试或取消本次开始');
    const hash = createHash('sha256').update(dto.answer).digest('hex');
    if (record.status === 'paused' || record.status === 'abandoned')
      throw new ConflictException('面试已暂停或放弃，请恢复状态');
    if (record.lastTurn?.requestId === dto.requestId) {
      if (
        record.lastTurn.answerHash !== hash ||
        record.lastTurn.expectedVersion !== dto.expectedVersion
      )
        throw new ConflictException('同一请求不能更换回答内容');
      if (record.status === 'completed') {
        events.next({
          type: Event.END,
          sessionId: dto.sessionId,
          resultId: record.resultId,
          requestId: dto.requestId,
          questionVersion: record.turnVersion,
          content: '本场面试已结束，可以查看复盘。',
          isStreaming: false,
        });
      } else record.lastTurn.events.forEach((event) => events.next(event));
      events.complete();
      return;
    }
    if (record.status !== 'in_progress')
      throw new ConflictException('面试已暂停或结束，请刷新状态');
    const session = this.session(record);
    const version = this.version(record, session);
    if (dto.expectedVersion !== version)
      throw new ConflictException('问题已更新，请恢复面试后继续');
    const question = session.conversationHistory.at(-1);
    if (
      !question ||
      question.role !== 'interviewer' ||
      !question.content.trim()
    ) {
      throw new ConflictException('当前问题尚未准备好，请稍后恢复面试');
    }
    const token = randomUUID();
    const claimed = await this.results.findOneAndUpdate(
      {
        _id: record._id,
        userId,
        status: 'in_progress',
        $and: [this.versionFilter(record.turnVersion || 0), availableLease()],
      },
      {
        $set: {
          turnLeaseToken: token,
          turnLeaseExpiresAt: new Date(Date.now() + LEASE_MS),
          turnVersion: version,
        },
      },
      { new: true },
    );
    if (!claimed)
      throw new ConflictException(
        '本轮正在处理或状态已更新，请稍后重试或恢复面试',
      );
    const fence = {
      _id: record._id,
      userId,
      status: 'in_progress',
      turnVersion: version,
      turnLeaseToken: token,
      turnLeaseExpiresAt: { $gt: new Date() },
    };
    try {
      const answeredAt = new Date();
      session.conversationHistory.push({
        role: 'candidate',
        content: dto.answer,
        timestamp: answeredAt,
      });
      session.questionCount = version + 1;
      const elapsedMinutes = Math.max(
        0,
        Math.floor((Date.now() - session.startTime.getTime()) / 60000),
      );
      events.next({
        type: Event.THINKING,
        sessionId: dto.sessionId,
        requestId: dto.requestId,
      });
      const next =
        elapsedMinutes >= session.targetDuration
          ? {
              question:
                '今天的面试到这里，感谢你的分享。接下来可以回看回答并生成复盘。',
              shouldEnd: true,
            }
          : await this.generate(session, elapsedMinutes, events, dto.requestId);
      const askedAt = new Date();
      session.conversationHistory.push({
        role: 'interviewer',
        content: next.question,
        timestamp: askedAt,
        standardAnswer: next.standardAnswer,
      });
      if (next.metadata) Object.assign(session, next.metadata);
      session.isActive = !next.shouldEnd;
      // 一次写入本轮回答、下一题、Agent 状态与重放凭据，禁止半轮写入。
      const qaList: InterviewQA[] = record.toObject().qaList;
      const pending = qaList.at(-1);
      if (!pending || pending.answer || pending.question !== question.content) {
        throw new ConflictException('问答记录不一致，请保留草稿并联系支持');
      }
      pending.answer = dto.answer;
      pending.answeredAt = answeredAt;
      pending.savedAt = askedAt;
      if (!next.shouldEnd)
        qaList.push({
          question: next.question,
          answer: '',
          standardAnswer: next.standardAnswer,
          askedAt,
        });
      const finalEvents: MockInterviewEventDto[] = [
        {
          type: next.shouldEnd ? Event.END : Event.QUESTION,
          sessionId: dto.sessionId,
          resultId: record.resultId,
          requestId: dto.requestId,
          questionVersion: version + 1,
          questionNumber: version + 1,
          interviewerName: session.interviewerName,
          content: next.question,
          elapsedMinutes,
          isStreaming: false,
        },
      ];
      if (!next.shouldEnd)
        finalEvents.push({
          type: Event.WAITING,
          sessionId: dto.sessionId,
          requestId: dto.requestId,
          questionVersion: version + 1,
        });
      const saved = await this.results.findOneAndUpdate(
        { ...fence, turnLeaseExpiresAt: { $gt: new Date() } },
        {
          $set: {
            sessionState: session,
            qaList,
            turnVersion: version + 1,
            status: next.shouldEnd ? 'completed' : 'in_progress',
            ...(next.shouldEnd ? { completedAt: askedAt } : {}),
            totalQuestions: qaList.length,
            answeredQuestions: qaList.filter((qa) => qa.answer.trim()).length,
            lastTurn: {
              requestId: dto.requestId,
              expectedVersion: dto.expectedVersion,
              answerHash: hash,
              events: finalEvents,
            },
          },
          $unset: { turnLeaseToken: 1, turnLeaseExpiresAt: 1 },
        },
        { new: true },
      );
      if (!saved)
        throw new ConflictException('本轮状态已变化，请恢复面试确认结果');
      finalEvents.forEach((event) => events.next(event));
      events.complete();
    } catch (error) {
      await this.results.updateOne(
        { _id: record._id, turnLeaseToken: token },
        {
          $unset: { turnLeaseToken: 1, turnLeaseExpiresAt: 1 },
        },
      );
      throw error;
    }
  }

  private async generate(
    session: InterviewSession,
    elapsedMinutes: number,
    events: Subject<MockInterviewEventDto>,
    requestId: string,
  ) {
    const generator = this.agent.generateInterviewQuestionStream({
      interviewType:
        session.interviewType === 'special' ? 'special' : 'comprehensive',
      resumeContent: session.resumeContent,
      company: session.company,
      positionName: session.positionName,
      jd: session.jd,
      conversationHistory: session.conversationHistory,
      elapsedMinutes,
      targetDuration: session.targetDuration,
      currentPhase: session.currentPhase,
      questionsAskedCount: session.questionsAskedCount,
      extractedSkills: session.extractedSkills,
    });
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const generation = (async () => {
      let text = '';
      let part = await generator.next();
      while (!part.done) {
        if (!active) throw new ServiceUnavailableException('生成已超时');
        text += part.value;
        const visible = text.split('[STANDARD_ANSWER]')[0];
        events.next({
          type: Event.QUESTION,
          sessionId: session.sessionId,
          requestId,
          content: visible,
          isStreaming: true,
        });
        part = await generator.next();
      }
      return generatedTurn.parse(part.value);
    })();
    try {
      return await Promise.race([
        generation,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new ServiceUnavailableException('生成超时，草稿已保留，请重试'),
              ),
            GENERATION_MS,
          );
        }),
      ]);
    } finally {
      active = false;
      clearTimeout(timer);
      // 不等待不可中断的上游；迟到内容不会再推送或落库。供应商取消另行接入。
      void generator
        .return({ question: '', shouldEnd: false })
        .catch(() => undefined);
    }
  }

  private async load(userId: string, resultId: string) {
    const record = await this.results.findOne({ userId, resultId });
    if (!record) throw new NotFoundException('面试记录不存在');
    if (record.startStatus && record.startStatus !== 'ready')
      throw new ConflictException('开场尚未完成，请重试或取消本次开始');
    return record;
  }

  async resume(userId: string, resultId: string) {
    let record = await this.load(userId, resultId);
    let session = this.session(record);
    if (record.status === 'paused') {
      const now = new Date();
      if (record.pausedAt)
        session.startTime = new Date(
          session.startTime.getTime() +
            Math.max(0, now.getTime() - new Date(record.pausedAt).getTime()),
        );
      session.isActive = true;
      const restored = await this.results.findOneAndUpdate(
        { _id: record._id, userId, status: 'paused', ...availableLease() },
        {
          $set: {
            status: 'in_progress',
            resumedAt: now,
            sessionState: session,
          },
        },
        { new: true },
      );
      if (!restored) throw new ConflictException('状态已变化，请重新恢复');
      record = restored;
      session = this.session(record);
    }
    if (!['in_progress', 'completed'].includes(record.status))
      throw new ConflictException('此面试无法继续');
    return {
      resultId,
      sessionId: session.sessionId,
      interviewerName: session.interviewerName,
      status: record.status,
      currentQuestion: this.version(record, session),
      questionVersion: this.version(record, session),
      lastQuestion: session.conversationHistory.at(-1)?.content,
      committedRequestId: record.lastTurn?.requestId ?? null,
      busyUntil:
        record.turnLeaseExpiresAt &&
        record.turnLeaseExpiresAt.getTime() > Date.now()
          ? record.turnLeaseExpiresAt
          : null,
      conversationHistory: session.conversationHistory.map(
        ({ role, content, timestamp }) => ({ role, content, timestamp }),
      ),
    };
  }

  async pause(userId: string, resultId: string) {
    const record = await this.load(userId, resultId);
    if (record.status === 'paused')
      return { resultId, pausedAt: record.pausedAt };
    const pausedAt = new Date();
    const saved = await this.results.findOneAndUpdate(
      { _id: record._id, userId, status: 'in_progress', ...availableLease() },
      {
        $set: { status: 'paused', pausedAt },
      },
    );
    if (!saved)
      throw new ConflictException('本轮正在处理或面试已结束，请稍后重试');
    return { resultId, pausedAt };
  }

  async end(userId: string, resultId: string) {
    const record = await this.load(userId, resultId);
    if (record.status === 'completed') return;
    const session = this.session(record);
    session.isActive = false;
    const saved = await this.results.findOneAndUpdate(
      {
        _id: record._id,
        userId,
        status: { $in: ['in_progress', 'paused'] },
        $and: [this.versionFilter(record.turnVersion || 0), availableLease()],
      },
      {
        $set: {
          status: 'completed',
          completedAt: new Date(),
          sessionState: session,
        },
        $unset: { turnLeaseToken: 1, turnLeaseExpiresAt: 1 },
      },
    );
    if (!saved)
      throw new ConflictException('本轮正在处理或状态已更新，请稍后重试');
  }
}
