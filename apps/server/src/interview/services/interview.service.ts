import {
  InterviewHistoryQueryDto,
  InterviewHistoryItem,
  InterviewHistoryPage,
} from '../dto/interview-history.dto';
// src/interview/services/interview.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionManager } from '../../ai/services/session.manager';
import { ResumeAnalysisService } from './resume-analysis.service';
import { ConversationContinuationService } from './conversation-continuation.service';
import { RESUME_ANALYSIS_SYSTEM_MESSAGE } from '../prompts/resume-analysis.prompts';
import { Subject } from 'rxjs';
import { ResumeQuizDto } from '../dto/resume-quiz.dto';
import { v4 as uuidv4 } from 'uuid';
import { ConsumptionStatus } from '../schemas/consumption-record.schema';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { Resume, ResumeDocument } from '../../resume/schemas/resume.schema';
import { Model, Types } from 'mongoose';
import {
  ConsumptionRecord,
  ConsumptionRecordDocument,
} from '../schemas/consumption-record.schema';
import {
  ResumeQuizResult,
  ResumeQuizResultDocument,
} from '../schemas/interview-quiz-result.schema';
import { DocumentParserService } from './document-parser.service';
import { InterviewReportService } from './interview-report.service';
import { InterviewAIService } from './interview-ai.service';
import { InterviewTurnService } from './interview-turn.service';
import { InterviewStartService } from './interview-start.service';
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
    private configService: ConfigService,
    private sessionManager: SessionManager,
    private resumeAnalysisService: ResumeAnalysisService,
    private conversationContinuationService: ConversationContinuationService,
    private documentParserService: DocumentParserService,
    private aiService: InterviewAIService,
    private turns: InterviewTurnService,
    private starts: InterviewStartService,
    private reports: InterviewReportService,
    @InjectModel(ConsumptionRecord.name)
    private consumptionRecordModel: Model<ConsumptionRecordDocument>,
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

  /**
   * 生成简历押题（带流式进度）
   * @param userId 用户ID
   * @param dto 请求参数
   * @returns Subject 流式事件
   */
  generateResumeQuizWithProgress(
    userId: string,
    dto: ResumeQuizDto,
  ): Subject<ProgressEvent> {
    const subject = new Subject<ProgressEvent>();

    // 异步执行，通过 Subject 发送进度
    this.executeResumeQuiz(userId, dto, subject).then(
      (result) => {
        subject.next({ type: 'yati-complete', progress: 100, data: result });
        subject.complete();
      },
      (error: unknown) => subject.error(error),
    );

    return subject;
  }

  /**
   * 执行简历押题（核心业务逻辑）
   */
  private async executeResumeQuiz(
    userId: string,
    dto: ResumeQuizDto,
    progressSubject?: Subject<ProgressEvent>,
  ): Promise<any> {
    let consumptionRecord: any = null;
    let deducted = false;
    const recordId = uuidv4();
    const resultId = uuidv4();
    console.log('recordId', recordId);

    // 处理错误
    try {
      // ========== 步骤 0: 幂等性检查 ==========
      // ⚠️ 这是最关键的一步：防止重复生成
      if (dto.requestId) {
        // 在数据库中查询是否存在这个 requestId 的记录
        const existingRecord = await this.consumptionRecordModel.findOne({
          userId,
          'metadata.requestId': dto.requestId,
          status: {
            $in: [ConsumptionStatus.SUCCESS, ConsumptionStatus.PENDING],
          },
        });

        if (existingRecord) {
          // 找到了相同 requestId 的记录！

          if (existingRecord.status === ConsumptionStatus.SUCCESS) {
            // 之前已经成功生成过，直接返回已有的结果
            this.logger.log(
              `重复请求，返回已有结果: requestId=${dto.requestId}`,
            );

            // 查询之前生成的结果
            const existingResult = await this.resumeQuizResultModel.findOne({
              resultId: existingRecord.resultId,
              userId,
            });

            if (!existingResult) {
              throw new BadRequestException('结果不存在');
            }

            // ✅ 直接返回，不再执行后续步骤，不再扣费
            return {
              resultId: existingResult.resultId,
              questions: existingResult.questions,
              summary: existingResult.summary,
              matchScore: existingResult.matchScore,
              matchLevel: existingResult.matchLevel,
              matchedSkills: existingResult.matchedSkills,
              missingSkills: existingResult.missingSkills,
              knowledgeGaps: existingResult.knowledgeGaps,
              learningPriorities: existingResult.learningPriorities,
              radarData: existingResult.radarData,
              strengths: existingResult.strengths,
              weaknesses: existingResult.weaknesses,
              interviewTips: existingResult.interviewTips,
              remainingCount: await this.getRemainingCount(userId, 'resume'),
              consumptionRecordId: existingRecord.recordId,
              // ⭐ 重要：标记这是从缓存返回的结果
              isFromCache: true,
            };
          }

          if (existingRecord.status === ConsumptionStatus.PENDING) {
            // 同一个请求还在处理中，告诉用户稍后查询
            throw new BadRequestException('请求正在处理中，请稍后查询结果');
          }
        }
      }

      // ========== 步骤 1: 检查并扣除次数（原子操作）==========
      // ⚠️ 注意：扣费后如果后续步骤失败，会在 catch 块中自动退款

      const user = await this.userModel.findOneAndUpdate(
        {
          _id: userId,
          resumeRemainingCount: { $gt: 0 }, // 条件：必须余额 > 0
        },
        {
          $inc: { resumeRemainingCount: -1 }, // 原子操作：余额 - 1
        },
        { new: false }, // 返回更新前的文档，用于日志记录
      );

      // 检查扣费是否成功
      if (!user) {
        throw new BadRequestException('简历押题次数不足，请前往充值页面购买');
      }
      deducted = true;

      // 记录详细日志
      this.logger.log(
        `✅ 用户扣费成功: userId=${userId}, 扣费前=${user.resumeRemainingCount}, 扣费后=${user.resumeRemainingCount - 1}`,
      );

      // ========== 步骤 2: 创建消费记录（pending）==========

      consumptionRecord = await this.consumptionRecordModel.create({
        recordId, // 消费记录唯一ID
        user: new Types.ObjectId(userId),
        userId,
        type: ConsumptionType.RESUME_QUIZ, // 消费类型
        status: ConsumptionStatus.PENDING, // ⭐ 关键：标记为处理中
        consumedCount: 1, // 消费次数
        description: `简历押题 - ${dto?.company} ${dto.positionName}`,

        // 记录输入参数（用于调试和重现问题）
        inputData: {
          company: dto?.company || '',
          positionName: dto.positionName,
          minSalary: dto.minSalary,
          maxSalary: dto.maxSalary,
          jd: dto.jd,
          resumeId: dto.resumeId,
        },

        resultId, // 结果ID（稍后会生成）

        // 元数据（包含幂等性检查的 requestId）
        metadata: {
          requestId: dto.requestId, // ← 用于幂等性检查
          promptVersion: dto.promptVersion,
        },

        startedAt: new Date(), // 记录开始时间
      });

      this.logger.log(`✅ 消费记录创建成功: recordId=${recordId}`);

      // ========== 阶段 1: 准备阶段==========
      this.emitProgress(
        progressSubject,
        0,
        '📄 正在读取简历文档...',
        'prepare',
      );
      this.logger.log(`📝 开始提取简历内容: resumeId=${dto.resumeId}`);
      const resumeContent = await this.extractResumeContent(userId, dto);
      this.logger.log(`✅ 简历内容提取成功: ${resumeContent}`);
      this.logger.log(`✅ 简历内容提取成功: 长度=${resumeContent.length}字符`);

      this.emitProgress(progressSubject, 5, '✅ 简历解析完成', 'prepare');

      this.emitProgress(
        progressSubject,
        10,
        '🚀 准备就绪，即将开始 AI 生成...',
      );
      // ========== 阶段 2: AI 生成阶段 - 分两步（10-90%）==========
      const aiStartTime = Date.now();

      this.logger.log(`🤖 开始生成押题部分...`);
      this.emitProgress(
        progressSubject,
        15,
        '🤖 AI 正在理解您的简历内容并生成面试问题...',
      );

      this.getStagePrompt(progressSubject);

      // ===== 第一步：生成押题部分（问题 + 综合评估）10-50% =====
      const questionsResult =
        await this.aiService.generateResumeQuizQuestionsOnly({
          company: dto?.company || '',
          positionName: dto.positionName,
          minSalary: dto.minSalary,
          maxSalary: dto.maxSalary,
          jd: dto.jd,
          resumeContent,
        });

      this.logger.log(
        `✅ 押题部分生成完成: 问题数=${questionsResult.questions?.length || 0}`,
      );

      this.emitProgress(
        progressSubject,
        50,
        '✅ 面试问题生成完成，开始分析匹配度...',
      );
      // ===== 第二步：生成匹配度分析部分，后续不在需要记录进度 =====
      this.logger.log(`🤖 开始生成匹配度分析...`);
      this.emitProgress(
        progressSubject,
        60,
        '🤖 AI 正在分析您与岗位的匹配度...',
      );

      const analysisResult =
        await this.aiService.generateResumeQuizAnalysisOnly({
          company: dto?.company || '',
          positionName: dto.positionName,
          minSalary: dto.minSalary,
          maxSalary: dto.maxSalary,
          jd: dto.jd,
          resumeContent,
        });

      this.logger.log(`✅ 匹配度分析完成`);

      const aiDuration = Date.now() - aiStartTime;
      this.logger.log(
        `⏱️ AI 总耗时: ${aiDuration}ms (${(aiDuration / 1000).toFixed(1)}秒)`,
      );
      // 合并两部分结果
      const aiResult = {
        ...questionsResult,
        ...analysisResult,
      };

      // ========== 阶段 3: 保存结果阶段==========
      const quizResult = await this.resumeQuizResultModel.create({
        resultId,
        user: new Types.ObjectId(userId),
        userId,
        resumeId: dto.resumeId,
        company: dto?.company || '',
        position: dto.positionName,
        jobDescription: dto.jd,
        questions: aiResult.questions,
        totalQuestions: aiResult.questions.length,
        summary: aiResult.summary,
        // AI生成的分析报告数据
        matchScore: aiResult.matchScore,
        matchLevel: aiResult.matchLevel,
        matchedSkills: aiResult.matchedSkills,
        missingSkills: aiResult.missingSkills,
        knowledgeGaps: aiResult.knowledgeGaps,
        learningPriorities: aiResult.learningPriorities,
        radarData: aiResult.radarData,
        strengths: aiResult.strengths,
        weaknesses: aiResult.weaknesses,
        interviewTips: aiResult.interviewTips,
        // 元数据
        consumptionRecordId: recordId,
        aiModel: this.configService.get('DEEPSEEK_MODEL') || 'deepseek-chat',
        promptVersion: dto.promptVersion || 'v2',
      });

      this.logger.log(`✅ 结果保存成功: resultId=${resultId}`);

      // 更新消费记录为成功
      await this.consumptionRecordModel.findByIdAndUpdate(
        consumptionRecord._id,
        {
          $set: {
            status: ConsumptionStatus.SUCCESS,
            outputData: {
              resultId,
              questionCount: aiResult.questions.length,
            },
            aiModel:
              this.configService.get('DEEPSEEK_MODEL') || 'deepseek-chat',
            promptTokens: aiResult.usage?.promptTokens,
            completionTokens: aiResult.usage?.completionTokens,
            totalTokens: aiResult.usage?.totalTokens,
            completedAt: new Date(),
          },
        },
      );

      this.logger.log(
        `✅ 消费记录已更新为成功状态: recordId=${consumptionRecord.recordId}`,
      );
      // ========== 阶段 4: 返回结果==========
      const result = {
        resultId: resultId,
        questions: questionsResult.questions,
        summary: questionsResult.summary,
        // 匹配度分析数据
        matchScore: analysisResult.matchScore,
        matchLevel: analysisResult.matchLevel,
        matchedSkills: analysisResult.matchedSkills,
        missingSkills: analysisResult.missingSkills,
        knowledgeGaps: analysisResult.knowledgeGaps,
        learningPriorities: analysisResult.learningPriorities,
        radarData: analysisResult.radarData,
        strengths: analysisResult.strengths,
        weaknesses: analysisResult.weaknesses,
        interviewTips: analysisResult.interviewTips,
      };

      // 发送完成事件
      this.emitProgress(
        progressSubject,
        100,
        '✅ 所有分析完成，正在保存结果...',
        'done',
      );

      return result;
    } catch (error) {
      this.logger.error(
        `❌ 简历押题生成失败: userId=${userId}, error=${error.message}`,
        error.stack,
      );

      // ========== 失败回滚流程 ==========
      try {
        // 1. 返还次数（最重要！）
        if (deducted) {
          await this.refundCount(userId, 'resume');
          deducted = false;
        }

        // 2. 更新消费记录为失败
        if (consumptionRecord) {
          await this.consumptionRecordModel.findByIdAndUpdate(
            consumptionRecord._id,
            {
              $set: {
                status: ConsumptionStatus.FAILED, // 标记为失败
                errorMessage: error.message, // 记录错误信息
                errorStack:
                  process.env.NODE_ENV === 'development'
                    ? error.stack // 开发环境记录堆栈
                    : undefined, // 生产环境不记录（隐私考虑）
                failedAt: new Date(),
                isRefunded: true, // ← 标记为已退款
                refundedAt: new Date(),
              },
            },
          );
          this.logger.log(
            `✅ 消费记录已更新为失败状态: recordId=${consumptionRecord.recordId}`,
          );
        }
      } catch (refundError) {
        // ⚠️ 退款失败是严重问题，需要人工介入！
        this.logger.error(
          `🚨 退款流程失败！这是严重问题，需要人工介入！` +
            `userId=${userId}, ` +
            `originalError=${error.message}, ` +
            `refundError=${refundError.message}`,
          refundError.stack,
        );

        // TODO: 这里应该发送告警通知（钉钉、邮件等）
        // await this.alertService.sendCriticalAlert({
        //   type: 'REFUND_FAILED',
        //   userId,
        //   error: refundError.message,
        // });
      }

      // 3. 发送错误事件给前端
      if (progressSubject && !progressSubject.closed) {
        progressSubject.next({
          type: 'error',
          progress: 0,
          label: '❌ 生成失败',
          error:
            error instanceof Error ? error.message : '服务暂时不可用，请重试',
        });
        progressSubject.complete();
      }

      throw error;
    }
  }

  /**
   * 退还次数
   * ⚠️ 关键方法：确保在任何失败情况下都能正确退还用户次数
   */
  private async refundCount(
    userId: string,
    type: 'resume' | 'special' | 'behavior',
  ): Promise<void> {
    const field =
      type === 'resume'
        ? 'resumeRemainingCount'
        : type === 'special'
          ? 'specialRemainingCount'
          : 'behaviorRemainingCount';

    // 使用原子操作退还次数
    const result = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $inc: { [field]: 1 },
      },
      { new: true }, // 返回更新后的文档
    );

    // 验证退款是否成功
    if (!result) {
      throw new Error(`退款失败：用户不存在 userId=${userId}`);
    }

    this.logger.log(
      `✅ 次数退还成功: userId=${userId}, type=${type}, 退还后=${result[field]}`,
    );
  }

  /**
   * 发送进度事件
   * @param subject 进度 Subject
   * @param progress 进度百分比 (0-100)
   * @param label 进度提示文本
   * @param stage 当前阶段
   */
  private emitProgress(
    subject: Subject<ProgressEvent> | undefined,
    progress: number,
    label: string,
    stage?: 'prepare' | 'generating' | 'saving' | 'done',
  ): void {
    if (subject && !subject.closed) {
      subject.next({
        type: 'progress',
        progress: Math.min(Math.max(progress, 0), 100), // 确保在 0-100 范围内
        label,
        message: label,
        stage,
      });
    }
  }

  /**
   * 获取剩余次数
   * resume： 简历押题
   * special：专项面试
   * behavior：HR + 行测面试
   */
  private async getRemainingCount(
    userId: string,
    type: 'resume' | 'special' | 'behavior',
  ): Promise<number> {
    const user = await this.userModel.findById(userId);
    if (!user) return 0;

    switch (type) {
      case 'resume':
        return user.resumeRemainingCount;
      case 'special':
        return user.specialRemainingCount;
      case 'behavior':
        return user.behaviorRemainingCount;
      default:
        return 0;
    }
  }

  /**
   * 不同阶段的提示信息
   */
  private getStagePrompt(
    progressSubject: Subject<ProgressEvent> | undefined,
  ): void {
    if (!progressSubject) return;
    // 定义不同阶段的提示信息
    const progressMessages = [
      // 0-20%: 理解阶段
      { progress: 0.05, message: '🤖 AI 正在深度理解您的简历内容...' },
      { progress: 0.1, message: '📊 AI 正在分析您的技术栈和项目经验...' },
      { progress: 0.15, message: '🔍 AI 正在识别您的核心竞争力...' },
      { progress: 0.2, message: '📋 AI 正在对比岗位要求与您的背景...' },

      // 20-50%: 设计问题阶段
      { progress: 0.25, message: '💡 AI 正在设计针对性的技术问题...' },
      { progress: 0.3, message: '🎯 AI 正在挖掘您简历中的项目亮点...' },
      { progress: 0.35, message: '🧠 AI 正在构思场景化的面试问题...' },
      { progress: 0.4, message: '⚡ AI 正在设计不同难度的问题组合...' },
      { progress: 0.45, message: '🔬 AI 正在分析您的技术深度和广度...' },
      { progress: 0.5, message: '📝 AI 正在生成基于 STAR 法则的答案...' },

      // 50-70%: 优化阶段
      { progress: 0.55, message: '✨ AI 正在优化问题的表达方式...' },
      { progress: 0.6, message: '🎨 AI 正在为您准备回答要点和技巧...' },
      { progress: 0.65, message: '💎 AI 正在提炼您的项目成果和亮点...' },
      { progress: 0.7, message: '🔧 AI 正在调整问题难度分布...' },

      // 70-85%: 完善阶段
      { progress: 0.75, message: '📚 AI 正在补充技术关键词和考察点...' },
      { progress: 0.8, message: '🎓 AI 正在完善综合评估建议...' },
      { progress: 0.85, message: '🚀 AI 正在做最后的质量检查...' },
      { progress: 0.9, message: '✅ AI 即将完成问题生成...' },
    ];

    // 模拟一个定时器：每间隔一秒，响应一次数据
    let progress = 0;
    let currentMessage = progressMessages[0];
    const interval = setInterval(
      () => {
        progress += 1;
        currentMessage = progressMessages[progress];
        // 发送进度事件
        this.emitProgress(
          progressSubject,
          progress,
          currentMessage?.message,
          'generating',
        );
        // 简单处理，到了 progressMessages 的 length 就结束了
        if (progress === progressMessages.length - 1) {
          clearInterval(interval);
          this.emitProgress(progressSubject, 45, 'AI 已完成问题生成', 'done');
          return {
            questions: [],
            analysis: [],
          };
        }
      },
      Math.floor(Math.random() * (2000 - 800 + 1)) + 800, // 每 0.8-2 秒更新一次
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
  ): Promise<any> {
    const EXCHANGE_COST = 20; // 每次兑换消耗 20 小麦币
    const EXCHANGE_COUNT = 1; // 每次兑换增加 1 次

    this.logger.log(
      `🎁 开始兑换套餐: userId=${userId}, packageType=${packageType}`,
    );

    // 1. 检查用户小麦币余额
    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException('用户不存在');
    }

    if (user.maiCoinBalance < EXCHANGE_COST) {
      throw new BadRequestException(
        `小麦币余额不足，需要 ${EXCHANGE_COST} 小麦币，当前余额 ${user.maiCoinBalance}`,
      );
    }

    // 2. 根据兑换类型确定要增加的次数字段
    let countField: string;
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

    // 3. 执行兑换（原子操作）
    const updateData = {
      $inc: {
        maiCoinBalance: -EXCHANGE_COST, // 扣除小麦币
        [countField]: EXCHANGE_COUNT, // 增加对应次数
      },
    };

    const updatedUser = await this.userModel.findOneAndUpdate(
      { _id: userId, maiCoinBalance: { $gte: EXCHANGE_COST } },
      updateData,
      { new: true },
    );

    if (!updatedUser) {
      throw new BadRequestException('小麦币余额不足，兑换未扣款');
    }

    this.logger.log(
      `✅ 兑换成功: userId=${userId}, packageType=${packageType}, ` +
        `小麦币余额=${updatedUser.maiCoinBalance}, ` +
        `${countField}=${updatedUser[countField]}`,
    );

    // 4. 创建交易记录（异步，不影响返回）
    const outTradeNo = `MAI${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`;

    try {
      await this.userTransactionModel.create({
        user: new Types.ObjectId(userId),
        userIdentifier: userId,
        type: UserTransactionType.EXPENSE,
        amount: EXCHANGE_COST,
        currency: 'MAI', // 小麦币
        description: `兑换${packageName}`,
        planName: '小麦币兑换',
        source: 'MAI_exchange',
        metadata: {
          packageType,
          packageName,
          exchangeCount: EXCHANGE_COUNT,
        },
        payData: {
          outTradeNo,
          paidAt: new Date(),
          channel: 'MAI',
        },
      });

      this.logger.log(`💾 交易记录已创建: outTradeNo=${outTradeNo}`);
    } catch (error) {
      // 记录失败不影响兑换结果
      this.logger.error(`❌ 创建交易记录失败: ${error.message}`);
    }

    // 5. 返回兑换结果（小麦币保留两位小数）
    return {
      success: true,
      message: `兑换成功！您已成功兑换 1 次${packageName}`,
      remainingMaiCoin: parseFloat(updatedUser.maiCoinBalance.toFixed(2)),
      remainingCount: updatedUser[countField],
      packageType,
      packageName,
      exchangeCost: EXCHANGE_COST,
      exchangeCount: EXCHANGE_COUNT,
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
          'resultId company position status reportStatus reportLeaseExpiresAt qaList.question qaList.answer createdAt -_id',
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
