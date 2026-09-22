import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, timeout, toArray } from 'rxjs';
import { SessionManager } from '../../src/ai/services/session.manager';
import { InterviewService } from '../../src/interview/services/interview.service';
import { ResumeAnalysisService } from '../../src/interview/services/resume-analysis.service';
import { ConversationContinuationService } from '../../src/interview/services/conversation-continuation.service';
import { DocumentParserService } from '../../src/interview/services/document-parser.service';
import { InterviewAIService } from '../../src/interview/services/interview-ai.service';
import { InterviewAgentService } from '../../src/interview/services/interview-agent.service';
import { MockInterviewType } from '../../src/interview/dto/mock-interview.dto';

const userId = '507f1f77bcf86cd799439011';

// 本组测试验证计费和会话边界，不加载或调用真实模型图。
jest.mock('../../src/interview/services/interview-agent.service', () => ({
  InterviewAgentService: class {},
}));

describe('interview reliability', () => {
  let service: InterviewService;
  let sessions: SessionManager;
  const user = {
    findOneAndUpdate: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findById: jest.fn(),
  };
  const consumption = { findOne: jest.fn(), create: jest.fn() };
  const quiz = { findOne: jest.fn() };
  const continuation = { continue: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InterviewService,
        SessionManager,
        ...[
          ConfigService,
          ResumeAnalysisService,
          DocumentParserService,
          InterviewAIService,
          InterviewAgentService,
        ].map((provide) => ({ provide, useValue: {} })),
        { provide: ConversationContinuationService, useValue: continuation },
        { provide: getModelToken('User'), useValue: user },
        { provide: getModelToken('ConsumptionRecord'), useValue: consumption },
        { provide: getModelToken('ResumeQuizResult'), useValue: quiz },
        ...['Resume', 'AIInterviewResult', 'UserTransaction'].map((name) => ({
          provide: getModelToken(name),
          useValue: {},
        })),
      ],
    }).compile();
    service = module.get(InterviewService);
    sessions = module.get(SessionManager);
  });

  it('never credits a resume request rejected before deduction', async () => {
    user.findOneAndUpdate.mockResolvedValue(null);
    const events = await lastValueFrom(
      service
        .generateResumeQuizWithProgress(userId, {
          positionName: '前端',
          jd: '岗位描述',
        })
        .pipe(timeout(1000), toArray()),
    );
    expect(events.map((event) => event.type)).toEqual(['error']);
    expect(user.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it.each([MockInterviewType.SPECIAL, MockInterviewType.COMPREHENSIVE])(
    'never credits a zero-quota %s interview',
    async (interviewType) => {
      user.findOneAndUpdate.mockResolvedValue(null);
      const events = await lastValueFrom(
        service
          .startMockInterviewWithStream(userId, { interviewType })
          .pipe(timeout(1000), toArray()),
      );
      expect(events.map((event) => event.type)).toEqual(['error']);
      expect(user.findByIdAndUpdate).not.toHaveBeenCalled();
    },
  );

  it('does not refund another request that is still pending', async () => {
    consumption.findOne.mockResolvedValue({ status: 'pending' });
    const events = await lastValueFrom(
      service
        .generateResumeQuizWithProgress(userId, {
          requestId: 'request-1',
          positionName: '前端',
          jd: '岗位描述',
        })
        .pipe(timeout(1000), toArray()),
    );
    expect(events[0].type).toBe('error');
    expect(user.findOneAndUpdate).not.toHaveBeenCalled();
    expect(user.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('sends cached results and closes the stream without deduction', async () => {
    consumption.findOne.mockResolvedValue({
      status: 'success',
      resultId: 'cached',
      recordId: 'paid',
    });
    quiz.findOne.mockResolvedValue({
      resultId: 'cached',
      questions: [{ question: '原问题' }],
      summary: '原总结',
    });
    user.findById.mockResolvedValue({ resumeRemainingCount: 2 });
    const events = await lastValueFrom(
      service
        .generateResumeQuizWithProgress(userId, {
          requestId: 'request-1',
          positionName: '前端',
          jd: '岗位描述',
        })
        .pipe(timeout(1000), toArray()),
    );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'yati-complete',
      data: { resultId: 'cached', isFromCache: true },
    });
    expect(user.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('checks balance atomically even if the initial balance read is stale', async () => {
    user.findById.mockResolvedValue({ maiCoinBalance: 20 });
    user.findOneAndUpdate.mockResolvedValue(null);
    await expect(service.exchangePackage(userId, 'resume')).rejects.toThrow(
      '小麦币余额不足',
    );
    expect(user.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: userId, maiCoinBalance: { $gte: 20 } },
      { $inc: { maiCoinBalance: -20, resumeRemainingCount: 1 } },
      { new: true },
    );
  });

  it('checks session ownership before mutating history or invoking the model', async () => {
    const id = sessions.createSession(userId, '前端', '系统提示');
    await expect(
      service.continueConversation('other-user', id, '读取他人的经历'),
    ).rejects.toThrow('会话不存在');
    expect(sessions.getHistory(id)).toHaveLength(1);
    expect(continuation.continue).not.toHaveBeenCalled();
    continuation.continue.mockResolvedValue('针对你的问题');
    expect(await service.continueConversation(userId, id, '我的问题')).toBe(
      '针对你的问题',
    );
  });
});
