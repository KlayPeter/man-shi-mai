import axios from 'axios';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StsService } from '../../src/sts/sts.service';
import { InterviewStartService } from '../../src/interview/services/interview-start.service';
import { QuotaLedgerService } from '../../src/user/quota-ledger.service';
import { InterviewTurnService } from '../../src/interview/services/interview-turn.service';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { lastValueFrom, of, timeout, toArray } from 'rxjs';
import { SessionManager } from '../../src/ai/services/session.manager';
import { InterviewReportService } from '../../src/interview/services/interview-report.service';
import { InterviewService } from '../../src/interview/services/interview.service';
import { InterviewQuizService } from '../../src/interview/services/interview-quiz.service';
import { ResumeAnalysisService } from '../../src/interview/services/resume-analysis.service';
import { ConversationContinuationService } from '../../src/interview/services/conversation-continuation.service';
import { DocumentParserService } from '../../src/interview/services/document-parser.service';
import { InterviewAIService } from '../../src/interview/services/interview-ai.service';
import { InterviewAgentService } from '../../src/interview/services/interview-agent.service';
import { MockInterviewType } from '../../src/interview/dto/mock-interview.dto';

jest.mock('axios');

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
  const resumes = { findById: jest.fn() };
  const storage = new StsService(
    new ConfigService({
      OSS_BUCKET: 'test-bucket',
      OSS_REGION: 'oss-cn-beijing',
    }),
  );
  const parser = new DocumentParserService(storage);
  const starts = { start: jest.fn() };
  const quota = { apply: jest.fn() };
  const transactions = { updateOne: jest.fn(), exists: jest.fn() };
  const continuation = { continue: jest.fn() };
  const quizService = { start: jest.fn() };

  afterEach(() => jest.restoreAllMocks());

  beforeEach(async () => {
    jest.resetAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        InterviewService,
        { provide: InterviewStartService, useValue: starts },
        { provide: InterviewQuizService, useValue: quizService },
        { provide: QuotaLedgerService, useValue: quota },
        SessionManager,
        ...[
          ConfigService,
          InterviewReportService,
          InterviewTurnService,
          ResumeAnalysisService,
          InterviewAIService,
          InterviewAgentService,
        ].map((provide) => ({ provide, useValue: {} })),
        { provide: DocumentParserService, useValue: parser },
        { provide: getModelToken('Resume'), useValue: resumes },
        { provide: ConversationContinuationService, useValue: continuation },
        { provide: getModelToken('User'), useValue: user },
        { provide: getModelToken('ConsumptionRecord'), useValue: consumption },
        { provide: getModelToken('ResumeQuizResult'), useValue: quiz },
        ...['AIInterviewResult'].map((name) => ({
          provide: getModelToken(name),
          useValue: {},
        })),
        { provide: getModelToken('UserTransaction'), useValue: transactions },
      ],
    }).compile();
    service = module.get(InterviewService);
    sessions = module.get(SessionManager);
  });

  it.each(['pdf', 'docx'])(
    'resolves a saved %s resume into the interview opening',
    async (extension) => {
      const url = `https://test-bucket.oss-cn-beijing.aliyuncs.com/user-resumes/${userId}/resume.${extension}`;
      resumes.findById.mockResolvedValue({ userId, url });
      jest
        .spyOn(storage, 'getResumeReadUrl')
        .mockResolvedValue('https://signed.example.test/file');
      jest.mocked(axios.get).mockResolvedValue({
        data: readFileSync(join(__dirname, 'fixtures', `resume.${extension}`)),
      });
      service.startMockInterviewWithStream(userId, {
        requestId: '4f387521-e4c9-46da-ab7f-da395e70254f',
        interviewType: MockInterviewType.SPECIAL,
        positionName: '前端',
        resumeId: '507f1f77bcf86cd799439012',
      });
      const resolveResume: () => Promise<string> =
        starts.start.mock.calls[0][2];
      const text = await resolveResume();
      expect(text).toContain('Frontend engineer');
      expect(text).toContain('1.8 seconds to 0.9 seconds');
      expect(storage.getResumeReadUrl).toHaveBeenCalledWith(url, userId);
    },
  );

  it('uses the editor snapshot without downloading a file', async () => {
    resumes.findById.mockResolvedValue({
      userId,
      plainTextSnapshot: '编辑器保存的合成简历',
      url: 'unused',
    });
    expect(
      await service['extractResumeContent'](userId, { resumeId: 'saved' }),
    ).toBe('编辑器保存的合成简历');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('rejects another user resume before parsing', async () => {
    resumes.findById.mockResolvedValue({
      userId: 'another-user',
      url: 'private',
    });
    await expect(
      service['extractResumeContent'](userId, { resumeId: 'saved' }),
    ).rejects.toThrow('无权访问');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('rejects file parsing when storage is unconfigured, without a download', async () => {
    const unconfigured = new DocumentParserService(
      new StsService(new ConfigService({})),
    );
    await expect(
      unconfigured.parseDocumentFromUrl(
        'https://example.test/resume.pdf',
        userId,
      ),
    ).rejects.toThrow('尚未配置');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('delegates resume quiz to the durable quiz service without direct debit', async () => {
    const dto = {
      requestId: '4f387521-e4c9-46da-ab7f-da395e70254f',
      positionName: '前端',
      jd: '岗位描述',
      resumeContent: '合成经历',
    };
    quizService.start.mockReturnValue(
      of({ type: 'yati-complete', progress: 100, data: { resultId: 'saved' } }),
    );
    const events = await lastValueFrom(
      service
        .generateResumeQuizWithProgress(userId, dto)
        .pipe(timeout(1000), toArray()),
    );
    expect(events[0].data).toEqual({ resultId: 'saved' });
    expect(quizService.start).toHaveBeenCalledWith(
      userId,
      dto,
      expect.any(Function),
    );
    expect(await quizService.start.mock.calls[0][2]()).toBe('合成经历');
    expect(user.findOneAndUpdate).not.toHaveBeenCalled();
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
