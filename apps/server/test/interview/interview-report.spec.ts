import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { InterviewReportService } from '../../src/interview/services/interview-report.service';
import { InterviewAIService } from '../../src/interview/services/interview-ai.service';
import { validateAssessment } from '../../src/interview/schemas/assessment-output';

const output = {
  overallScore: 0,
  overallLevel: '待练习',
  overallComment: '本次回答有待补充',
  radarData: [],
  strengths: [],
  weaknesses: [],
  improvements: [],
  fluencyScore: null,
  logicScore: null,
  professionalScore: null,
  evidence: [
    {
      questionNumber: 1,
      quote: '做了缓存',
      kind: 'improvement',
      feedback: '未说明缓存收益',
      practice: '补充测量方法与结果',
    },
  ],
};

describe('报告契约与证据', () => {
  it('合法零分不被默认 75 分覆盖，无法观察的指标保留 null', () => {
    expect(validateAssessment(output, ['我做了缓存。'])).toMatchObject({
      overallScore: 0,
      fluencyScore: null,
    });
  });
  it('拒绝缺少必填字段、越界分数、伪造引用和错题引用', () => {
    expect(() => validateAssessment({}, ['我做了缓存。'])).toThrow();
    expect(() =>
      validateAssessment({ ...output, overallScore: 120 }, ['我做了缓存。']),
    ).toThrow();
    expect(() => validateAssessment(output, ['我做了索引。'])).toThrow(
      '报告引用与回答原文不一致',
    );
    expect(() =>
      validateAssessment(
        { ...output, evidence: [{ ...output.evidence[0], questionNumber: 2 }] },
        ['我做了缓存。'],
      ),
    ).toThrow();
  });
});

describe('InterviewReportService', () => {
  let service: InterviewReportService;
  const results = {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateOne: jest.fn(),
  };
  const ai = { generateInterviewAssessmentReport: jest.fn() };
  const base = {
    resultId: 'fixture',
    userId: 'owner',
    interviewType: 'special',
    status: 'completed',
    reportStatus: 'pending',
    qaList: [{ question: '如何优化？', answer: '我做了缓存。' }],
    reportAttempts: 0,
    sessionState: { resumeContent: '不能泄露的简历' },
  };
  beforeEach(async () => {
    jest.resetAllMocks();
    results.findOne.mockResolvedValue(base);
    results.findOneAndUpdate.mockResolvedValue(null);
    results.updateOne.mockResolvedValue({ modifiedCount: 1 });
    ai.generateInterviewAssessmentReport.mockResolvedValue(output);
    const module = await Test.createTestingModule({
      providers: [
        InterviewReportService,
        { provide: getModelToken('AIInterviewResult'), useValue: results },
        { provide: InterviewAIService, useValue: ai },
      ],
    }).compile();
    service = module.get(InterviewReportService);
  });
  it('只读状态不触发模型；保留原问答、不暴露简历与会话', async () => {
    const review = await service.read('owner', 'fixture');
    expect(review.status).toBe('pending');
    expect(review.questions[0].answer).toBe('我做了缓存。');
    expect(review).not.toHaveProperty('sessionState');
    expect(results.findOne).toHaveBeenCalledWith({
      userId: 'owner',
      resultId: 'fixture',
    });
    expect(ai.generateInterviewAssessmentReport).not.toHaveBeenCalled();
  });
  it('未知记录返回 404 而不是生成中', async () => {
    results.findOne.mockResolvedValue(null);
    await expect(service.read('other', 'fixture')).rejects.toThrow(
      NotFoundException,
    );
  });
  it('无回答时不生成低分报告，也不调用模型', async () => {
    results.findOne.mockResolvedValue({
      ...base,
      qaList: [{ question: '请介绍一下', answer: ' ' }],
      overallScore: 30,
      reportStatus: 'completed',
    });
    expect(await service.requestGeneration('owner', 'fixture')).toMatchObject({
      status: 'insufficient_data',
      report: null,
      canGenerate: false,
    });
    expect(ai.generateInterviewAssessmentReport).not.toHaveBeenCalled();
  });
  it('面试未结束时不允许提前生成', async () => {
    results.findOne.mockResolvedValue({ ...base, status: 'in_progress' });
    await expect(service.requestGeneration('owner', 'fixture')).rejects.toThrow(
      BadRequestException,
    );
  });
  it('有效生成租约不重复调用，历史无租约的 generating 可恢复', async () => {
    results.findOne.mockResolvedValue({
      ...base,
      reportStatus: 'generating',
      reportLeaseExpiresAt: new Date(Date.now() + 60_000),
    });
    expect((await service.requestGeneration('owner', 'fixture')).status).toBe(
      'generating',
    );
    expect(results.findOneAndUpdate).not.toHaveBeenCalled();
    results.findOne.mockResolvedValue({ ...base, reportStatus: 'generating' });
    expect(await service.read('owner', 'fixture')).toMatchObject({
      status: 'failed',
      canGenerate: true,
    });
  });
  it('重试有上限，失败不删除问答', async () => {
    results.findOne.mockResolvedValue({
      ...base,
      reportStatus: 'failed',
      reportAttempts: 3,
    });
    const review = await service.read('owner', 'fixture');
    expect(review.canGenerate).toBe(false);
    expect(review.questions).toHaveLength(1);
    await expect(service.requestGeneration('owner', 'fixture')).rejects.toThrow(
      '重试上限',
    );
  });
  it('合法报告按领取凭据保存版本和证据；模型故障明确保存失败', async () => {
    results.findOneAndUpdate.mockResolvedValue(base);
    await service.requestGeneration('owner', 'fixture');
    await new Promise((resolve) => setImmediate(resolve));
    expect(results.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({
        resultId: 'fixture',
        reportLeaseToken: expect.any(String),
      }),
      expect.objectContaining({
        $set: expect.objectContaining({
          overallScore: 0,
          reportStatus: 'completed',
          reportRubricVersion: 'interview-evidence-v1',
          reportEvidence: output.evidence,
        }),
      }),
    );
    ai.generateInterviewAssessmentReport.mockRejectedValue(
      new Error('upstream secret should not leak'),
    );
    await service.requestGeneration('owner', 'fixture');
    await new Promise((resolve) => setImmediate(resolve));
    expect(results.updateOne).toHaveBeenLastCalledWith(
      expect.objectContaining({ reportLeaseToken: expect.any(String) }),
      expect.objectContaining({
        $set: {
          reportStatus: 'failed',
          reportError: '生成失败，请重试；原问答已保留',
        },
      }),
    );
  });
});
