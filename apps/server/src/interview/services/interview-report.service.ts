import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import {
  AIInterviewResult,
  AIInterviewResultDocument,
} from '../schemas/ai-interview-result.schema';
import { InterviewAIService } from './interview-ai.service';
import {
  ASSESSMENT_VERSION,
  validateAssessment,
} from '../schemas/assessment-output';

export type ReviewStatus =
  | 'not_ready'
  | 'pending'
  | 'generating'
  | 'completed'
  | 'failed'
  | 'insufficient_data';
const MAX_ATTEMPTS = 3;
const LEASE_MS = 120_000;

@Injectable()
export class InterviewReportService {
  private readonly logger = new Logger(InterviewReportService.name);
  constructor(
    @InjectModel(AIInterviewResult.name)
    private readonly results: Model<AIInterviewResultDocument>,
    private readonly ai: InterviewAIService,
  ) {}

  private async owned(userId: string, resultId: string) {
    const record = await this.results.findOne({ resultId, userId });
    if (!record) throw new NotFoundException('面试记录不存在');
    return record;
  }

  status(
    record: Pick<
      AIInterviewResult,
      'status' | 'qaList' | 'reportStatus' | 'reportLeaseExpiresAt'
    >,
  ): ReviewStatus {
    if (record.status !== 'completed') return 'not_ready';
    if (
      !(record.qaList || []).some(
        (item) => item?.question?.trim() && item?.answer?.trim(),
      )
    )
      return 'insufficient_data';
    if (
      record.reportStatus === 'generating' &&
      (!record.reportLeaseExpiresAt ||
        new Date(record.reportLeaseExpiresAt).getTime() <= Date.now())
    )
      return 'failed';
    return [
      'pending',
      'generating',
      'completed',
      'failed',
      'insufficient_data',
    ].includes(record.reportStatus)
      ? (record.reportStatus as ReviewStatus)
      : 'pending';
  }

  async read(userId: string, resultId: string) {
    const record = await this.owned(userId, resultId);
    const status = this.status(record);
    const attempts = record.reportAttempts || 0;
    const questions = (record.qaList || []).map((qa, index) => ({
      questionNumber: index + 1,
      question: qa?.question || '',
      answer: qa?.answer || '',
      score: qa?.score ?? null,
      comment: qa?.aiComment || '',
      highlights: qa?.highlights || [],
      improvements: qa?.improvements || [],
    }));
    // 历史报告可读，但没有证据就不能伪造引用；也不暴露整份 sessionState/简历。
    return {
      resultId,
      type: record.interviewType,
      position: record.position || '',
      company: record.company || '',
      status,
      attempts,
      canGenerate:
        ['pending', 'failed'].includes(status) && attempts < MAX_ATTEMPTS,
      message:
        status === 'insufficient_data'
          ? '本场没有可分析的回答，无法评估表现。'
          : status === 'failed'
            ? attempts >= MAX_ATTEMPTS
              ? '多次生成失败，原问答已保留，请联系反馈。'
              : '报告生成失败或中断，可以重新生成，原问答已保留。'
            : status === 'not_ready'
              ? '面试尚未结束，可先回看已经保存的问答。'
              : '',
      questions,
      report:
        status === 'completed'
          ? {
              overallScore: record.overallScore ?? null,
              overallLevel: record.overallLevel || '',
              summary: record.overallComment || '',
              radarData: record.radarData || [],
              strengths: record.strengths || [],
              weaknesses: record.weaknesses || [],
              improvements: record.improvements || [],
              evidence: record.reportEvidence || [],
              rubricVersion: record.reportRubricVersion || null,
            }
          : null,
    };
  }

  async requestGeneration(userId: string, resultId: string) {
    const record = await this.owned(userId, resultId);
    const status = this.status(record);
    if (status === 'not_ready') throw new BadRequestException('请先结束面试');
    if (
      status === 'completed' ||
      status === 'generating' ||
      status === 'insufficient_data'
    )
      return this.read(userId, resultId);
    if ((record.reportAttempts || 0) >= MAX_ATTEMPTS)
      throw new BadRequestException('已达到本场报告重试上限，原问答已保留');
    const token = uuidv4();
    const now = new Date();
    const claimed = await this.results.findOneAndUpdate(
      {
        resultId,
        userId,
        status: 'completed',
        $and: [
          {
            $or: [
              { reportAttempts: { $lt: MAX_ATTEMPTS } },
              { reportAttempts: { $exists: false } },
            ],
          },
          {
            $or: [
              { reportStatus: { $in: ['pending', 'failed'] } },
              { reportStatus: { $exists: false } },
              {
                reportStatus: 'generating',
                reportLeaseExpiresAt: { $lte: now },
              },
              {
                reportStatus: 'generating',
                reportLeaseExpiresAt: { $exists: false },
              },
            ],
          },
        ],
      },
      {
        $set: {
          reportStatus: 'generating',
          reportLeaseToken: token,
          reportLeaseExpiresAt: new Date(now.getTime() + LEASE_MS),
        },
        $inc: { reportAttempts: 1 },
        $unset: { reportError: 1 },
      },
      { new: true },
    );
    if (claimed) {
      void this.generate(claimed, token).catch(() => {
        // 如果连失败状态也写不回，租约过期后可由用户重新领取；不会造成未处理拒绝。
        this.logger.error(`报告状态写入失败: resultId=${resultId}`);
      });
    }
    return this.read(userId, resultId);
  }

  private async generate(record: AIInterviewResultDocument, token: string) {
    const condition = { resultId: record.resultId, reportLeaseToken: token };
    try {
      const qaList = (record.qaList || []).map((item) => ({
        question: item?.question || '',
        answer: item?.answer || '',
        standardAnswer: item?.standardAnswer,
      }));
      const snapshot: unknown = record.sessionState;
      const resumeContent =
        snapshot &&
        typeof snapshot === 'object' &&
        'resumeContent' in snapshot &&
        typeof snapshot.resumeContent === 'string'
          ? snapshot.resumeContent
          : '';
      const output = await this.ai.generateInterviewAssessmentReport(
        {
          interviewType:
            record.interviewType === 'special' ? 'special' : 'comprehensive',
          company: record.company || '',
          positionName: record.position || '',
          jd: record.jobDescription || '',
          resumeContent,
          qaList,
        },
        AbortSignal.timeout(90_000),
      );
      const assessment = validateAssessment(
        output,
        qaList.map((item) => item.answer),
      );
      const { evidence, ...scores } = assessment;
      await this.results.updateOne(condition, {
        $set: {
          ...scores,
          reportStatus: 'completed',
          reportGeneratedAt: new Date(),
          reportEvidence: evidence,
          reportRubricVersion: ASSESSMENT_VERSION,
        },
        $unset: {
          reportLeaseToken: 1,
          reportLeaseExpiresAt: 1,
          reportError: 1,
        },
      });
    } catch {
      this.logger.warn(`报告生成未完成: resultId=${record.resultId}`);
      await this.results.updateOne(condition, {
        $set: {
          reportStatus: 'failed',
          reportError: '生成失败，请重试；原问答已保留',
        },
        $unset: { reportLeaseToken: 1, reportLeaseExpiresAt: 1 },
      });
    }
  }
}
