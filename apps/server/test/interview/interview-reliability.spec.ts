import { InterviewStartService } from '../../src/interview/services/interview-start.service';
import { QuotaLedgerService } from '../../src/user/quota-ledger.service';
import { InterviewTurnService } from '../../src/interview/services/interview-turn.service';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, timeout, toArray } from 'rxjs';
import { SessionManager } from '../../src/ai/services/session.manager';
import { InterviewReportService } from '../../src/interview/services/interview-report.service';
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
  const starts = { start: jest.fn() };
  const quota = { apply: jest.fn() };
  const transactions = { updateOne: jest.fn(), exists: jest.fn() };
  const continuation = { continue: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: InterviewStartService, useValue: starts },
        { provide: QuotaLedgerService, useValue: quota },
        SessionManager,
        ...[
          ConfigService,
          InterviewReportService,
          InterviewTurnService,
          ResumeAnalysisService,
          DocumentParserService,
          InterviewAIService,
          InterviewAgentService,
        ].map((provide) => ({ provide, useValue: {} })),
        { provide: ConversationContinuationService, useValue: continuation },
        { provide: getModelToken('User'), useValue: user },
        { provide: getModelToken('ConsumptionRecord'), useValue: consumption },
        { provide: getModelToken('ResumeQuizResult'), useValue: quiz },
        ...['Resume', 'AIInterviewResult'].map((name) => ({
          provide: getModelToken(name),
          useValue: {},
        })),
        { provide: getModelToken('UserTransaction'), useValue: transactions },
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

  it('delegates opening to the durable start service without another debit', () => {
    const dto = {
      requestId: '4f387521-e4c9-46da-ab7f-da395e70254f',
      interviewType: MockInterviewType.SPECIAL,
      positionName: '前端',
    };
    service.startMockInterviewWithStream(userId, dto);
    expect(starts.start).toHaveBeenCalledWith(
      userId,
      dto,
      expect.any(Function),
    );
    expect(user.findOneAndUpdate).not.toHaveBeenCalled();
  });

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

  it('applies coin debit and practice credit together, and reuses one transaction identity', async () => {
    quota.apply.mockResolvedValue({ operationId: 'exchange-op' });
    user.findById.mockResolvedValue({
      maiCoinBalance: 0,
      resumeRemainingCount: 1,
    });
    const requestId = '4f387521-e4c9-46da-ab7f-da395e70254f';
    expect(
      (await service.exchangePackage(userId, 'resume', requestId))
        .remainingCount,
    ).toBe(1);
    expect(
      (await service.exchangePackage(userId, 'resume', requestId)).requestId,
    ).toBe(requestId);
    expect(quota.apply).toHaveBeenCalledWith(
      userId,
      'package-exchange',
      requestId,
      {
        maiCoinBalance: -20,
        resumeRemainingCount: 1,
      },
    );
    expect(transactions.updateOne).toHaveBeenCalledTimes(2);
    expect(transactions.updateOne.mock.calls[0][0]).toEqual({
      relatedOrderId: 'exchange-op',
    });
    expect(user.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('does not create an exchange transaction if the ledger rejects the debit', async () => {
    quota.apply.mockRejectedValue(new BadRequestException('小麦币不足'));
    await expect(
      service.exchangePackage(
        userId,
        'resume',
        '4f387521-e4c9-46da-ab7f-da395e70254f',
      ),
    ).rejects.toThrow('小麦币不足');
    expect(transactions.updateOne).not.toHaveBeenCalled();
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
