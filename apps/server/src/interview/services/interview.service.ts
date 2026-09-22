import {
  InterviewHistoryQueryDto,
  InterviewHistoryItem,
  InterviewHistoryPage,
} from '../dto/interview-history.dto';
// src/interview/services/interview.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { QuotaLedgerService } from '../../user/quota-ledger.service';
import { SessionManager } from '../../ai/services/session.manager';
import { ResumeAnalysisService } from './resume-analysis.service';
import { ConversationContinuationService } from './conversation-continuation.service';
import { RESUME_ANALYSIS_SYSTEM_MESSAGE } from '../prompts/resume-analysis.prompts';
import { Subject } from 'rxjs';
import { ResumeQuizDto } from '../dto/resume-quiz.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { Resume, ResumeDocument } from '../../resume/schemas/resume.schema';
import { Model, Types } from 'mongoose';
import {
  ResumeQuizResult,
  ResumeQuizResultDocument,
} from '../schemas/interview-quiz-result.schema';
import { DocumentParserService } from './document-parser.service';
import { InterviewReportService } from './interview-report.service';
import { InterviewTurnService } from './interview-turn.service';
import { InterviewStartService } from './interview-start.service';
import { InterviewQuizService } from './interview-quiz.service';
import {
  StartMockInterviewDto,
  MockInterviewEventDto,
} from '../dto/mock-interview.dto';
import {
  AIInterviewResult,
  AIInterviewResultDocument,
} from '../schemas/ai-interview-result.schema';
import { ResumeQuizAnalysisDto } from '../dto/analysis-report.dto';

import {
  UserTransaction,
  UserTransactionDocument,
  UserTransactionType,
} from '../../user/schemas/user-transaction.schema';

import { traceIdStorage } from '../../common/middleware/trace-id.middleware';
/**
 * 进度事件
 */
export interface ProgressEvent {
  type: 'progress' | 'complete' | 'error' | 'timeout' | 'yati-complete';
  step?: number;
  label?: string;
  progress: number; // 0-100
  message?: string;
  data?: any;
  error?: string;
  terminal?: boolean;
  stage?: 'prepare' | 'generating' | 'saving' | 'done'; // 当前阶段
}

/**
 * 消费类型枚举
 */
export enum ConsumptionType {
  RESUME_QUIZ = 'resume_quiz', // 简历押题
  SPECIAL_INTERVIEW = 'special_interview', // 专项面试
  BEHAVIOR_INTERVIEW = 'behavior_interview', // 行测+HR面试
  AI_INTERVIEW = 'ai_interview', // AI模拟面试（如果使用次数计费）
}

/**
 * 面试服务
 *
 * 这个服务只关心业务逻辑和流程编排：
 * 1. 创建会话
 * 2. 调用具体的分析服务（简历分析、对话继续等）
 * 3. 管理会话历史
 *
 * 不关心具体的 AI 实现细节，那些交给专门的分析服务。
 */
@Injectable()
export class InterviewService {
  private readonly logger = new Logger(InterviewService.name);

  constructor(
    private sessionManager: SessionManager,
    private resumeAnalysisService: ResumeAnalysisService,
    private conversationContinuationService: ConversationContinuationService,
    private documentParserService: DocumentParserService,
    private turns: InterviewTurnService,
    private starts: InterviewStartService,
    private quizService: InterviewQuizService,
    private quota: QuotaLedgerService,
    private reports: InterviewReportService,
    @InjectModel(ResumeQuizResult.name)
    private resumeQuizResultModel: Model<ResumeQuizResultDocument>,
    @InjectModel(User.name)
    private userModel: Model<UserDocument>,
    @InjectModel(Resume.name)
    private resumeModel: Model<ResumeDocument>,
    @InjectModel(AIInterviewResult.name)
    private aiInterviewResultModel: Model<AIInterviewResultDocument>,
    @InjectModel(UserTransaction.name)
    private userTransactionModel: Model<UserTransactionDocument>,
  ) {}

  /**
   * 分析简历（首轮，创建会话）
   *
   * @param userId 用户 ID
   * @param position 职位名称
   * @param resumeContent 简历内容
   * @param jobDescription 岗位要求
   * @returns 分析结果和 sessionId
   */
  async analyzeResume(
    userId: string,
    position: string,
    resumeContent: string,
    jobDescription: string,
  ) {
    try {
      const traceId = traceIdStorage.getStore();
      // 第一步：创建新会话
      const systemMessage = RESUME_ANALYSIS_SYSTEM_MESSAGE(position);
      const sessionId = this.sessionManager.createSession(
        userId,
        position,
        systemMessage,
      );

      this.logger.log(`[${traceId}]创建会话: ${sessionId}`);

      // 第二步：调用专门的简历分析服务
      const result = await this.resumeAnalysisService.analyze(
        resumeContent,
        jobDescription,
      );

      // 第三步：保存用户输入到会话历史
      this.sessionManager.addMessage(
        sessionId,
        'user',
        `简历内容：${resumeContent}`,
      );

      // 第四步：保存 AI 的回答到会话历史
      this.sessionManager.addMessage(
        sessionId,
        'assistant',
        JSON.stringify(result),
      );

      this.logger.log(`简历分析完成，sessionId: ${sessionId}`);

      return {
        sessionId,
        analysis: result,
      };
    } catch (error) {
      this.logger.error(`分析简历失败: ${error}`);
      throw error;
    }
  }

  /**
   * 继续对话（多轮，基于现有会话）
   *
   * @param sessionId 会话 ID
   * @param userQuestion 用户问题
   * @returns AI 的回答
   */
  async continueConversation(
    userId: string,
    sessionId: string,
    userQuestion: string,
  ): Promise<string> {
    this.sessionManager.assertOwner(sessionId, userId);
    try {
      // 第一步：添加用户问题到会话历史
      this.sessionManager.addMessage(sessionId, 'user', userQuestion);

      // 第二步：获取对话历史
      const history = this.sessionManager.getRecentMessages(sessionId, 10);

      this.logger.log(
        `继续对话，sessionId: ${sessionId}，历史消息数: ${history.length}`,
      );

      // 第三步：调用专门的对话继续服务
      const aiResponse =
        await this.conversationContinuationService.continue(history);

      // 第四步：保存 AI 的回答到会话历史
      this.sessionManager.addMessage(sessionId, 'assistant', aiResponse);

      this.logger.log(`对话继续完成，sessionId: ${sessionId}`);

      return aiResponse;
    } catch (error) {
      this.logger.error(`继续对话失败: ${error}`);
      throw error;
    }
  }

  /** 按同一请求 ID 恢复押题；完成事件由持久化服务发送。 */
  generateResumeQuizWithProgress(
    userId: string,
    dto: ResumeQuizDto,
  ): Subject<ProgressEvent> {
    return this.quizService.start(userId, dto, () =>
      this.extractResumeContent(userId, dto),
    );
  }

  /**
   * 提取简历内容
   * 支持三种方式：直接文本、结构化简历、上传文件
   */
  private async extractResumeContent(
    userId: string,
    dto: Pick<ResumeQuizDto, 'resumeContent' | 'resumeId' | 'resumeURL'>,
  ): Promise<string> {
    // 优先级 1：如果直接提供了简历文本，使用它
    if (dto.resumeContent) {
      this.logger.log(
        `✅ 使用直接提供的简历文本，长度=${dto.resumeContent.length}字符`,
      );
      return dto.resumeContent;
    }

    // 优先级 2：如果提供了 resumeId，从数据库查询简历
    let urlToDownload = dto.resumeURL;

    if (dto.resumeId) {
      this.logger.log(`📝 从数据库查询简历: resumeId=${dto.resumeId}`);
      const resume = await this.resumeModel.findById(dto.resumeId);

      if (!resume) {
        throw new BadRequestException('简历不存在');
      }

      if (resume.userId !== userId) {
        throw new BadRequestException('无权访问该简历');
      }

      // 如果有纯文本快照，优先使用
      if (resume.plainTextSnapshot) {
        this.logger.log(
          `✅ 命中结构化简历纯文本快照，长度=${resume.plainTextSnapshot.length}字符`,
        );
        return resume.plainTextSnapshot;
      }

      urlToDownload = resume.url;
      this.logger.log('未发现纯文本快照，回退至文件解析');
    }

    // 优先级 3：如果有 URL（来自 resumeId 或 resumeURL），下载并解析
    if (urlToDownload) {
      try {
        // 1. 从 URL 下载文件
        const rawText = await this.documentParserService.parseDocumentFromUrl(
          urlToDownload,
          userId,
        );

        // 2. 清理文本（移除格式化符号等）
        const cleanedText = this.documentParserService.cleanText(rawText);

        // 3. 验证内容质量
        const validation =
          this.documentParserService.validateResumeContent(cleanedText);

        if (!validation.isValid) {
          throw new BadRequestException(validation.reason);
        }

        // 4. 记录任何警告
        if (validation.warnings && validation.warnings.length > 0) {
          this.logger.warn(`简历解析警告: ${validation.warnings.join('; ')}`);
        }

        // 5. 检查内容长度（避免超长内容）
        const estimatedTokens =
          this.documentParserService.estimateTokens(cleanedText);

        if (estimatedTokens > 6000) {
          this.logger.warn(
            `简历内容过长: ${estimatedTokens} tokens，将进行截断`,
          );
          // 截取前 6000 tokens 对应的字符
          const maxChars = 6000 * 1.5; // 约 9000 字符
          const truncatedText = cleanedText.substring(0, maxChars);

          this.logger.log(
            `简历已截断: 原长度=${cleanedText.length}, ` +
              `截断后=${truncatedText.length}, ` +
              `tokens≈${this.documentParserService.estimateTokens(truncatedText)}`,
          );

          return truncatedText;
        }

        this.logger.log(
          `✅ 简历解析成功: 长度=${cleanedText.length}字符, ` +
            `tokens≈${estimatedTokens}`,
        );

        return cleanedText;
      } catch (error) {
        // 文件解析失败，返回友好的错误信息
        if (error instanceof BadRequestException) {
          throw error;
        }

        this.logger.error(
          `❌ 解析简历文件失败: resumeId=${dto.resumeId}, error=${error.message}`,
          error.stack,
        );

        throw new BadRequestException(
          `简历文件解析失败: ${error.message}。` +
            `建议：确保上传的是文本型 PDF 或 DOCX 文件，未加密且未损坏。` +
            `或者直接粘贴简历文本。`,
        );
      }
    }

    // 都没提供，返回错误
    throw new BadRequestException('请提供简历ID、简历URL或简历内容');
  }

  startMockInterviewWithStream(
    userId: string,
    dto: StartMockInterviewDto,
  ): Subject<MockInterviewEventDto> {
    return this.starts.start(userId, dto, () =>
      dto.resumeId || dto.resumeContent?.trim()
        ? this.extractResumeContent(userId, dto)
        : Promise.resolve(''),
    );
  }

  cancelMockInterviewStart(userId: string, dto: StartMockInterviewDto) {
    return this.starts.cancel(userId, dto);
  }

  cancelMockInterviewStartResult(userId: string, resultId: string) {
    return this.starts.cancelResult(userId, resultId);
  }

  answerMockInterviewWithStream(
    userId: string,
    sessionId: string,
    answer: string,
    requestId: string,
    expectedVersion: number,
  ): Subject<MockInterviewEventDto> {
    return this.turns.answer(userId, {
      sessionId,
      answer,
      requestId,
      expectedVersion,
    });
  }

  endMockInterview(userId: string, resultId: string) {
    return this.turns.end(userId, resultId);
  }

  pauseMockInterview(userId: string, resultId: string) {
    return this.turns.pause(userId, resultId);
  }

  resumeMockInterview(userId: string, resultId: string) {
    return this.turns.resume(userId, resultId);
  }

  /**
   * 获取分析报告
   * 根据结果ID自动识别类型并返回对应的分析报告
   * 统一返回 ResumeQuizAnalysisDto 格式
   * @param userId 用户ID
   * @param resultId 结果ID
   * @returns 分析报告
   */
  async getAnalysisReport(userId: string, resultId: string): Promise<any> {
    // 首先尝试从简历押题结果中查找
    const resumeQuizResult = await this.resumeQuizResultModel.findOne({
      resultId,
      userId,
    });

    if (resumeQuizResult) {
      const result = this.generateResumeQuizAnalysis(resumeQuizResult);
      return result;
    }

    // 然后尝试从AI面试结果中查找
    const aiInterviewResult = await this.aiInterviewResultModel.findOne({
      resultId,
      userId,
    });

    if (aiInterviewResult) {
      const review = await this.reports.read(userId, resultId);
      if (review.status !== 'completed' || !review.report) {
        throw new BadRequestException({
          message: review.message || '报告尚未生成，请在复盘页发起生成',
          error: { reportStatus: review.status },
        });
      }
      // 保留旧查询地址，但只读且使用一致字段，不再隐式触发模型。
      return {
        resultId,
        type: aiInterviewResult.interviewType,
        company: review.company,
        position: review.position,
        matchScore: review.report.overallScore,
        matchLevel: review.report.overallLevel,
        summary: review.report.summary,
        strengths: review.report.strengths,
        weaknesses: review.report.weaknesses,
        radarData: review.report.radarData.map((item) => ({
          label: item.dimension,
          value: item.score,
        })),
        matchedSkills: [],
        missingSkills: [],
        knowledgeGaps: [],
        interviewTips: [],
        learningPriorities: review.report.improvements.map((item) => ({
          topic: item.category,
          reason: item.suggestion,
          priority: item.priority,
        })),
        totalQuestions: review.questions.length,
        questionDistribution: {},
        viewCount: aiInterviewResult.viewCount,
      };
    }

    throw new NotFoundException('未找到该分析报告');
  }

  /**
   * @description 生成并返回一份简历押题分析报告。
   * 该函数不执行AI分析，而是将已存在的AI分析结果（存储在数据库中）格式化为DTO（数据传输对象），
   * 同时会更新该报告的查看次数和最后查看时间。
   * @param {ResumeQuizResultDocument} result - 从数据库中获取的简历押题结果文档，其中包含了AI已经生成的所有分析数据。
   * @returns {Promise<ResumeQuizAnalysisDto>} - 一个Promise，解析后为格式化好的分析报告DTO，用于前端展示或API返回。
   */
  private async generateResumeQuizAnalysis(
    result: ResumeQuizResultDocument,
  ): Promise<ResumeQuizAnalysisDto> {
    // --- 1. 更新文档的统计数据 ---
    // 每次调用此函数，都认为报告被查看了一次。
    // 使用 findByIdAndUpdate 原子地更新数据库中的文档，避免并发问题。
    await this.resumeQuizResultModel.findByIdAndUpdate(result._id, {
      // `$inc` 操作符会将 `viewCount` 字段的值加 1。
      $inc: { viewCount: 1 },
      // `$set` 操作符会更新 `lastViewedAt` 字段为当前最新时间。
      $set: { lastViewedAt: new Date() },
    });

    // --- 2. 获取并格式化创建时间 ---
    // Mongoose的timestamps功能会自动添加createdAt字段，但这里做了兼容处理。
    // 检查文档中是否存在 createdAt 字段。
    const createdAt = (result as any).createdAt
      ? // 如果存在，则将其转换为标准的 ISO 8601 格式字符串 (例如 "2023-10-27T10:00:00.000Z")。
        new Date((result as any).createdAt).toISOString()
      : // 如果不存在，则使用当前时间作为备用值。
        new Date().toISOString();

    // --- 3. 构造并返回数据传输对象 (DTO) ---
    // 这个返回的对象是专门为API响应或前端消费而设计的。
    // 它直接使用了 `result` 对象中由AI预先生成的分析数据。
    return {
      // --- 基础信息 ---
      resultId: result.resultId, // 结果的唯一标识ID
      type: 'resume_quiz', // 报告类型
      company: result.company || '', // 目标公司，如果不存在则返回空字符串
      position: result.position, // 目标职位
      salaryRange: result.salaryRange, // 薪资范围
      createdAt, // 格式化后的创建时间

      // --- AI生成的分析数据 ---
      // 下面的字段都是直接从数据库文档中获取的，如果某个字段不存在，则提供一个安全的默认值。
      matchScore: result.matchScore || 0, // 匹配度得分，默认为 0
      matchLevel: result.matchLevel || '中等', // 匹配等级，默认为 '中等'
      matchedSkills: result.matchedSkills || [], // 已匹配的技能列表，默认为空数组
      missingSkills: result.missingSkills || [], // 缺失的技能列表，默认为空数组
      knowledgeGaps: result.knowledgeGaps || [], // 知识盲区，默认为空数组
      // 学习优先级列表，这里做了一次 .map 操作以确保每个元素的结构和类型都符合 DTO 的定义
      learningPriorities: (result.learningPriorities || []).map((lp) => ({
        topic: lp.topic,
        // 将 `priority` 字段显式地转换为 'high' | 'medium' | 'low' 联合类型，增强类型安全
        priority: lp.priority as 'high' | 'medium' | 'low',
        reason: lp.reason,
      })),
      radarData: result.radarData || [], // 用于雷达图的数据，默认为空数组
      strengths: result.strengths || [], // 优势分析，默认为空数组
      weaknesses: result.weaknesses || [], // 劣势分析，默认为空数组
      summary: result.summary || '', // 综合总结，默认为空字符串
      interviewTips: result.interviewTips || [], // 面试建议，默认为空数组

      // --- 统计信息 ---
      // 使用可选链 `?.` 安全地获取问题数量，如果 `result.questions` 不存在，则返回 undefined，再通过 `|| 0` 设置为0
      totalQuestions: result.questions?.length || 0,
      questionDistribution: result.questionDistribution || {}, // 问题分布情况，默认为空对象
      viewCount: result.viewCount, // 最新的查看次数
    };
  }

  /**
   * 兑换套餐（使用小麦币兑换面试次数）
   * @param userId 用户ID
   * @param packageType 兑换类型
   * @returns 兑换结果
   */
  async exchangePackage(
    userId: string,
    packageType: 'resume' | 'special' | 'behavior',
    requestId: string,
  ): Promise<any> {
    const EXCHANGE_COST = 20; // 每次兑换消耗 20 小麦币
    const EXCHANGE_COUNT = 1; // 每次兑换增加 1 次

    this.logger.log(
      `🎁 开始兑换套餐: userId=${userId}, packageType=${packageType}`,
    );

    let countField:
      | 'resumeRemainingCount'
      | 'specialRemainingCount'
      | 'behaviorRemainingCount';
    let packageName: string;

    switch (packageType) {
      case 'resume':
        countField = 'resumeRemainingCount';
        packageName = '简历押题';
        break;
      case 'special':
        countField = 'specialRemainingCount';
        packageName = '专项面试';
        break;
      case 'behavior':
        countField = 'behaviorRemainingCount';
        packageName = '行测+HR面试';
        break;
      default:
        throw new BadRequestException('无效的兑换类型');
    }

    // 同一账户文档中扣币和加次数，重放只归档旧回执，不重复应用。
    const { operationId } = await this.quota.apply(
      userId,
      'package-exchange',
      requestId,
      { maiCoinBalance: -EXCHANGE_COST, [countField]: EXCHANGE_COUNT },
    );
    // 交易记录可补写：账本成功但此处故障时，同一 requestId 重试仍只兑换一次。
    try {
      await this.userTransactionModel.updateOne(
        { relatedOrderId: operationId },
        {
          $setOnInsert: {
            relatedOrderId: operationId,
            user: new Types.ObjectId(userId),
            userIdentifier: userId,
            type: UserTransactionType.EXPENSE,
            amount: EXCHANGE_COST,
            currency: 'MAI',
            description: `兑换${packageName}`,
            planName: '小麦币兑换',
            source: 'MAI_exchange',
            metadata: {
              packageType,
              packageName,
              exchangeCount: EXCHANGE_COUNT,
            },
          },
        },
        { upsert: true, writeConcern: { w: 'majority' } },
      );
    } catch (error: unknown) {
      if (
        !(
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 11000 &&
          (await this.userTransactionModel.exists({
            relatedOrderId: operationId,
            userIdentifier: userId,
          }))
        )
      )
        throw error;
    }

    const updatedUser = await this.userModel.findById(userId);
    if (!updatedUser) throw new BadRequestException('用户不存在');
    return {
      success: true,
      message: `兑换成功！您已成功兑换 1 次${packageName}`,
      remainingMaiCoin: parseFloat(updatedUser.maiCoinBalance.toFixed(2)),
      remainingCount: updatedUser[countField],
      packageType,
      packageName,
      exchangeCost: EXCHANGE_COST,
      exchangeCount: EXCHANGE_COUNT,
      requestId,
    };
  }

  async getResumeQuizHistory(
    userId: string,
    query: InterviewHistoryQueryDto = new InterviewHistoryQueryDto(),
  ): Promise<InterviewHistoryPage> {
    const filter = { userId };
    const [records, total] = await Promise.all([
      this.resumeQuizResultModel
        .find(filter)
        .select('resultId company position createdAt -_id')
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<Omit<InterviewHistoryItem, 'status'>[]>(),
      this.resumeQuizResultModel.countDocuments(filter),
    ]);
    return {
      list: records.map((record) => ({ ...record, status: 'completed' })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  getSpecialInterviewHistory(
    userId: string,
    query: InterviewHistoryQueryDto = new InterviewHistoryQueryDto(),
  ) {
    return this.getMockHistoryPage(userId, 'special', query);
  }

  getBehaviorInterviewHistory(
    userId: string,
    query: InterviewHistoryQueryDto = new InterviewHistoryQueryDto(),
  ) {
    return this.getMockHistoryPage(userId, 'behavior', query);
  }

  private async getMockHistoryPage(
    userId: string,
    interviewType: string,
    query: InterviewHistoryQueryDto,
  ): Promise<InterviewHistoryPage> {
    const filter = { userId, interviewType };
    const [list, total] = await Promise.all([
      this.aiInterviewResultModel
        .find(filter)
        .select(
          'resultId company position status startStatus reportStatus reportLeaseExpiresAt qaList.question qaList.answer createdAt -_id',
        )
        .sort({ createdAt: -1, _id: -1 })
        .skip((query.page - 1) * query.limit)
        .limit(query.limit)
        .lean<
          (InterviewHistoryItem &
            Pick<
              AIInterviewResult,
              'qaList' | 'reportLeaseExpiresAt' | 'reportStatus'
            >)[]
        >(),
      this.aiInterviewResultModel.countDocuments(filter),
    ]);
    return {
      list: list.map((item) => ({
        resultId: item.resultId,
        company: item.company,
        position: item.position,
        createdAt: item.createdAt,
        status: item.status,
        reportStatus: this.reports.status(item),
        ...(item.startStatus ? { startStatus: item.startStatus } : {}),
      })),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  /**
   * 获取简历押题结果详情
   */
  async getResumeQuizResult(userId: string, resultId: string): Promise<any> {
    const result = await this.resumeQuizResultModel.findOne({
      userId,
      resultId,
    });
    if (!result) {
      throw new NotFoundException('结果不存在');
    }
    return result;
  }

  /**
   * 获取模拟面试问答列表
   */
  async getMockInterviewQA(userId: string, resultId: string): Promise<any> {
    const result = await this.aiInterviewResultModel
      .findOne({ userId, resultId })
      .select('qaList');
    if (!result) {
      throw new NotFoundException('面试记录不存在');
    }
    return result.qaList;
  }

  /**
   * 获取模拟面试详情
   */
  async getMockInterviewHistory(
    userId: string,
    resultId: string,
  ): Promise<any> {
    const result = await this.aiInterviewResultModel
      .findOne({
        userId,
        resultId,
      })
      .select(
        '-turnLeaseToken -turnLeaseExpiresAt -lastTurn -reportLeaseToken -reportLeaseExpiresAt -startLeaseToken -startLeaseExpiresAt -startPayloadHash',
      );
    if (!result) {
      throw new NotFoundException('面试记录不存在');
    }
    return result;
  }

  /**
   * 获取未完成的模拟面试
   */
  async getUnfinishedMockInterviews(userId: string): Promise<any[]> {
    return await this.aiInterviewResultModel
      .find({
        userId,
        status: { $in: ['in_progress', 'paused'] },
      })
      .select(
        'resultId company position interviewType status createdAt updatedAt',
      )
      .sort({ updatedAt: -1 })
      .lean();
  }

  /**
   * 获取当前正在进行模拟面试的人数
   * 统计最近10分钟内有活动的面试记录数量
   */
  async getActiveMockInterviewCount(): Promise<number> {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const count = await this.aiInterviewResultModel.countDocuments({
      updatedAt: { $gte: tenMinutesAgo },
      status: { $ne: 'completed' },
    });
    return count;
  }
}
