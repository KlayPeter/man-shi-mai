import {
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomUUID } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { Subject } from 'rxjs';
import {
  QuotaLedgerService,
  quotaOperationId,
} from '../../user/quota-ledger.service';
import { ResumeQuizDto } from '../dto/resume-quiz.dto';
import {
  ConsumptionRecord,
  ConsumptionRecordDocument,
  ConsumptionStatus,
  ConsumptionType,
} from '../schemas/consumption-record.schema';
import {
  ResumeQuizResult,
  ResumeQuizResultDocument,
} from '../schemas/interview-quiz-result.schema';
import type { ProgressEvent } from './interview.service';
import { InterviewAIService } from './interview-ai.service';
import {
  quizAnalysis,
  quizOutput,
  quizQuestions,
  QuizOutput,
} from './interview-quiz.schema';

const durable = { writeConcern: { w: 'majority' as const } };
const LEASE_MS = 240_000;
const MODEL_MS = 90_000;
const availableLease = () => ({
  $or: [
    { quizLeaseToken: { $exists: false } },
    { quizLeaseExpiresAt: { $lte: new Date() } },
  ],
});

class QuizTerminalError extends Error {}

@Injectable()
export class InterviewQuizService {
  private readonly logger = new Logger(InterviewQuizService.name);
  constructor(
    @InjectModel(ConsumptionRecord.name)
    private readonly consumption: Model<ConsumptionRecordDocument>,
    @InjectModel(ResumeQuizResult.name)
    private readonly results: Model<ResumeQuizResultDocument>,
    private readonly quota: QuotaLedgerService,
    private readonly ai: InterviewAIService,
    private readonly config: ConfigService,
  ) {}

  start(
    userId: string,
    dto: ResumeQuizDto,
    resolveResume: () => Promise<string>,
  ) {
    const events = new Subject<ProgressEvent>();
    void Promise.resolve()
      .then(() => this.execute(userId, dto, resolveResume, events))
      .then((data) => {
        events.next({ type: 'yati-complete', progress: 100, data });
        events.complete();
      })
      .catch((error: unknown) => {
        this.logger.warn(
          `Quiz request failed: ${error instanceof HttpException ? error.getStatus() : 'internal'}`,
        );
        events.next({
          type: 'error',
          progress: 0,
          error:
            error instanceof HttpException || error instanceof QuizTerminalError
              ? error.message
              : '押题结果尚未确认，请重试同一次请求',
          terminal: error instanceof QuizTerminalError,
        });
        events.complete();
      });
    return events;
  }

  private key(userId: string, requestId: string) {
    return quotaOperationId(userId, 'resume-quiz', requestId);
  }

  private hash(dto: ResumeQuizDto) {
    return createHash('sha256')
      .update(
        JSON.stringify([
          dto.company || '',
          dto.positionName,
          dto.minSalary ?? null,
          dto.maxSalary ?? null,
          dto.jd,
          dto.resumeId || '',
          dto.resumeContent || '',
          dto.resumeURL || '',
          dto.promptVersion || '',
        ]),
      )
      .digest('hex');
  }

  private progress(
    events: Subject<ProgressEvent>,
    progress: number,
    label: string,
  ) {
    events.next({ type: 'progress', progress, label });
  }

  private async withTimeout<T>(work: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        work,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new ServiceUnavailableException('押题模型超时')),
            MODEL_MS,
          );
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async legacyReplay(userId: string, dto: ResumeQuizDto) {
    const old = await this.consumption.findOne({
      userId,
      type: ConsumptionType.RESUME_QUIZ,
      'metadata.requestId': dto.requestId,
      recordId: { $ne: this.key(userId, dto.requestId) },
    });
    if (!old) return null;
    if (old.status !== ConsumptionStatus.SUCCESS)
      throw new ConflictException(
        '旧押题请求仍在处理中或已失败，请查看练习记录后再重新提交',
      );
    const existing = await this.results.findOne({
      resultId: old.resultId,
      userId,
    });
    if (!existing)
      throw new ServiceUnavailableException('押题记录需要维护，请联系支持');
    // 旧记录由旧模型保存，字段可能少于新校验规则；只重放已有内容，不伪造分数。
    const data = {
      questions: existing.questions,
      summary: existing.summary,
      matchScore: existing.matchScore,
      matchLevel: existing.matchLevel,
      matchedSkills: existing.matchedSkills,
      missingSkills: existing.missingSkills,
      knowledgeGaps: existing.knowledgeGaps,
      learningPriorities: existing.learningPriorities,
      radarData: existing.radarData,
      strengths: existing.strengths,
      weaknesses: existing.weaknesses,
      interviewTips: existing.interviewTips,
      resultId: existing.resultId,
    } as unknown as QuizOutput & { resultId: string };
    return this.response(userId, old.recordId, data, true);
  }

  private async ensureRecord(userId: string, dto: ResumeQuizDto) {
    const recordId = this.key(userId, dto.requestId);
    const inputHash = this.hash(dto);
    try {
      await this.consumption.updateOne(
        { recordId },
        {
          $setOnInsert: {
            recordId,
            resultId: recordId,
            userId,
            user: new Types.ObjectId(userId),
            requestId: dto.requestId,
            type: ConsumptionType.RESUME_QUIZ,
            status: ConsumptionStatus.PENDING,
            quizPhase: 'preparing',
            quizInputHash: inputHash,
            consumedCount: 1,
            description: `简历押题 - ${dto.company || ''} ${dto.positionName}`,
            inputData: {
              company: dto.company || '',
              positionName: dto.positionName,
              minSalary: dto.minSalary,
              maxSalary: dto.maxSalary,
              jd: dto.jd,
              resumeId: dto.resumeId,
            },
            metadata: {
              requestId: dto.requestId,
              promptVersion: dto.promptVersion,
            },
            startedAt: new Date(),
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
    const record = await this.consumption
      .findOne({ recordId, userId })
      .select('+quizInputHash');
    if (!record || record.quizInputHash !== inputHash)
      throw new ConflictException(
        '同一次押题不能更换岗位或简历，请使用新的请求',
      );
    return record;
  }

  private async response(
    userId: string,
    recordId: string,
    data: QuizOutput & { resultId?: string },
    isFromCache: boolean,
  ) {
    const account = await this.quota.getBalance(userId);
    return {
      ...data,
      resultId: data.resultId || recordId,
      consumptionRecordId: recordId,
      remainingCount: account.resumeRemainingCount,
      isFromCache,
    };
  }

  private async replay(
    userId: string,
    dto: ResumeQuizDto,
    record: ConsumptionRecordDocument,
    cached: boolean,
  ) {
    const parsed = quizOutput.safeParse(record.outputData);
    if (!parsed.success)
      throw new ServiceUnavailableException('押题记录需要维护，请联系支持');
    const data = parsed.data;
    const resultId = record.resultId || record.recordId;
    try {
      await this.results.updateOne(
        { resultId },
        {
          $setOnInsert: {
            resultId,
            userId,
            user: new Types.ObjectId(userId),
            resumeId: dto.resumeId,
            company: dto.company || '',
            position: dto.positionName,
            jobDescription: dto.jd,
            questions: data.questions,
            totalQuestions: data.questions.length,
            summary: data.summary,
            matchScore: data.matchScore,
            matchLevel: data.matchLevel,
            matchedSkills: data.matchedSkills,
            missingSkills: data.missingSkills,
            knowledgeGaps: data.knowledgeGaps,
            learningPriorities: data.learningPriorities,
            radarData: data.radarData,
            strengths: data.strengths,
            weaknesses: data.weaknesses,
            interviewTips: data.interviewTips,
            consumptionRecordId: record.recordId,
            aiModel: this.config.get('DEEPSEEK_MODEL') || 'deepseek-chat',
            promptVersion: dto.promptVersion || 'v2',
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
    const saved = await this.results.findOne({ resultId, userId });
    if (!saved || saved.consumptionRecordId !== record.recordId)
      throw new ServiceUnavailableException('押题结果需要维护，请联系支持');
    return this.response(
      userId,
      record.recordId,
      { ...data, resultId },
      cached,
    );
  }

  private async release(recordId: string, userId: string, token: string) {
    await this.consumption.updateOne(
      {
        recordId,
        userId,
        status: ConsumptionStatus.PENDING,
        quizLeaseToken: token,
      },
      { $unset: { quizLeaseToken: 1, quizLeaseExpiresAt: 1 } },
      durable,
    );
  }

  private async refundPending(
    userId: string,
    dto: ResumeQuizDto,
    recordId: string,
    token: string,
  ): Promise<never> {
    try {
      const { wasApplied } = await this.quota.reverse(
        userId,
        'resume-quiz',
        dto.requestId,
        { resumeRemainingCount: -1 },
      );
      const finished = await this.consumption.findOneAndUpdate(
        {
          recordId,
          userId,
          status: ConsumptionStatus.PENDING,
          quizPhase: 'refunding',
          quizLeaseToken: token,
        },
        {
          $set: {
            status: ConsumptionStatus.FAILED,
            isRefunded: wasApplied,
            failedAt: new Date(),
            ...(wasApplied ? { refundedAt: new Date() } : {}),
            errorMessage: '押题生成失败，权益已核对',
          },
          $unset: { quizLeaseToken: 1, quizLeaseExpiresAt: 1 },
        },
        { new: true, ...durable },
      );
      if (!finished) throw new ConflictException('押题状态已更新，请重试确认');
      throw new QuizTerminalError(
        wasApplied
          ? '本次押题未完成，已退还押题次数。请重新提交。'
          : '本次押题未完成，未扣除押题次数。请核对余额后重新提交。',
      );
    } catch (error: unknown) {
      if (error instanceof QuizTerminalError) throw error;
      await this.release(recordId, userId, token);
      throw new ServiceUnavailableException(
        '押题退款状态尚未确认，请重试同一次请求',
      );
    }
  }

  private async execute(
    userId: string,
    dto: ResumeQuizDto,
    resolveResume: () => Promise<string>,
    events: Subject<ProgressEvent>,
  ) {
    const legacy = await this.legacyReplay(userId, dto);
    if (legacy) return legacy;
    let record = await this.ensureRecord(userId, dto);
    if (record.status === ConsumptionStatus.SUCCESS)
      return this.replay(userId, dto, record, true);
    if (record.status === ConsumptionStatus.FAILED)
      throw new QuizTerminalError('本次押题已结束并核对权益，请重新提交。');
    const recordId = record.recordId;
    const token = randomUUID();
    const claimed = await this.consumption.findOneAndUpdate(
      {
        recordId,
        userId,
        status: ConsumptionStatus.PENDING,
        ...availableLease(),
      },
      {
        $set: {
          quizLeaseToken: token,
          quizLeaseExpiresAt: new Date(Date.now() + LEASE_MS),
        },
      },
      { new: true, ...durable },
    );
    if (!claimed)
      throw new ConflictException('本次押题正在处理，请稍后重试同一请求');
    record = claimed;
    if (record.quizPhase === 'refunding')
      return this.refundPending(userId, dto, recordId, token);
    const fence = () => ({
      recordId,
      userId,
      status: ConsumptionStatus.PENDING,
      quizLeaseToken: token,
      quizLeaseExpiresAt: { $gt: new Date() },
    });
    let saveAttempted = false;
    try {
      this.progress(events, 0, '正在读取简历与岗位信息');
      const resumeContent = await resolveResume();
      await this.quota.apply(userId, 'resume-quiz', dto.requestId, {
        resumeRemainingCount: -1,
      });
      const generating = await this.consumption.updateOne(
        fence(),
        { $set: { quizPhase: 'generating' } },
        durable,
      );
      if (generating.matchedCount !== 1)
        throw new ConflictException('押题任务已转移，请重试确认');
      const input = {
        company: dto.company || '',
        positionName: dto.positionName,
        minSalary: dto.minSalary,
        maxSalary: dto.maxSalary,
        jd: dto.jd,
        resumeContent,
      };
      this.progress(events, 15, '正在生成岗位相关的问题');
      const questions = quizQuestions.parse(
        await this.withTimeout(this.ai.generateResumeQuizQuestionsOnly(input)),
      );
      this.progress(events, 60, '正在分析岗位匹配情况');
      const analysis = quizAnalysis.parse(
        await this.withTimeout(this.ai.generateResumeQuizAnalysisOnly(input)),
      );
      const output: QuizOutput = { ...questions, ...analysis };
      this.progress(events, 90, '正在保存押题结果');
      saveAttempted = true;
      const saved = await this.consumption.findOneAndUpdate(
        fence(),
        {
          $set: {
            status: ConsumptionStatus.SUCCESS,
            outputData: output,
            completedAt: new Date(),
            aiModel: this.config.get('DEEPSEEK_MODEL') || 'deepseek-chat',
          },
          $unset: { quizLeaseToken: 1, quizLeaseExpiresAt: 1 },
        },
        { new: true, ...durable },
      );
      if (!saved)
        throw new ConflictException('押题结果保存状态未确认，请重试同一请求');
      return this.replay(userId, dto, saved, false);
    } catch (error: unknown) {
      let latest: ConsumptionRecordDocument;
      try {
        const found = await this.consumption.findOne({ recordId, userId });
        if (!found) throw new Error('record missing');
        latest = found;
      } catch {
        throw new ServiceUnavailableException(
          '押题状态尚未确认，请重试同一次请求',
        );
      }
      if (latest.status === ConsumptionStatus.SUCCESS)
        return this.replay(userId, dto, latest, true);
      if (saveAttempted) {
        await this.release(recordId, userId, token);
        throw new ServiceUnavailableException(
          '押题结果保存状态尚未确认，请重试同一次请求',
        );
      }
      const refunding = await this.consumption.findOneAndUpdate(
        fence(),
        { $set: { quizPhase: 'refunding' } },
        { new: true, ...durable },
      );
      if (!refunding) throw new ConflictException('押题任务已转移，请重试确认');
      this.logger.warn(
        `Quiz generation failed before saving: ${error instanceof HttpException ? error.getStatus() : 'internal'}`,
      );
      return this.refundPending(userId, dto, recordId, token);
    }
  }
}
