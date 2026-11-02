import {
  scoreAssessment,
  AssessmentContext,
} from '../../src/interview/schemas/assessment-output';

const context: AssessmentContext = {
  interviewType: 'special',
  company: '',
  positionName: '前端',
  jd: 'React',
  resumeContent: '',
  qaList: [
    {
      question: '如何计算可见范围？',
      answer: '根据scrollTop和视口计算，再加缓冲行。',
    },
    { question: '如何验证收益？', answer: '我不知道，没有做测量。' },
    { question: '你有什么想问的？', answer: '我想了解团队如何做代码评审。' },
  ],
};
const item = (questionNumber: number, rating = 4) => ({
  questionNumber,
  excludedReason: null,
  ratings: {
    relevance: rating,
    correctness: rating,
    depth: rating,
    structure: rating,
  },
  quote: context.qaList[questionNumber - 1].answer,
  feedback: '基于本次回答的反馈',
  practice: '下一次解释并验证边界',
});
const excluded = {
  ...item(3),
  excludedReason: 'candidate_questions',
  ratings: { relevance: null, correctness: null, depth: null, structure: null },
};
const raw = () => ({
  overallComment: '有亮点，也有待练习部分',
  questionAssessments: [item(1), item(2, 1), excluded],
});

describe('evidence anchored scoring', () => {
  it('computes scores on the server and excludes candidate questions', () => {
    const report = scoreAssessment({ ...raw(), overallScore: 100 }, context);
    expect(report.questionAssessments?.map((q) => q.score)).toEqual([
      85,
      20,
      null,
    ]);
    expect(report.overallScore).toBe(53);
    expect(report.scoring).toMatchObject({
      scoredQuestions: 2,
      answeredQuestions: 3,
    });
    expect(report.fluencyScore).toBeNull();
  });
  it('gives excellent evidence an excellent level without a fabricated default', () => {
    const report = scoreAssessment(
      { ...raw(), questionAssessments: [item(1, 5), item(2, 5), excluded] },
      context,
    );
    expect(report.overallScore).toBe(100);
    expect(report.overallLevel).toBe('优秀');
  });
  it('does not turn unobserved dimensions into zero', () => {
    const report = scoreAssessment(
      {
        overallComment: '只观察到切题性',
        questionAssessments: [
          {
            ...item(1),
            ratings: {
              relevance: 4,
              correctness: null,
              depth: null,
              structure: null,
            },
          },
        ],
      },
      { ...context, qaList: context.qaList.slice(0, 1) },
    );
    expect(report.overallScore).toBe(85);
    expect(report.radarData).toHaveLength(1);
    expect(report.professionalScore).toBeNull();
  });
  it('uses different documented weights for technical and behavioral practice', () => {
    const value = {
      overallComment: '说明具体依据',
      questionAssessments: [
        {
          ...item(1),
          ratings: { relevance: 5, correctness: 5, depth: 2, structure: 4 },
        },
      ],
    };
    const input = { ...context, qaList: context.qaList.slice(0, 1) };
    expect(scoreAssessment(value, input).overallScore).toBe(87);
    expect(
      scoreAssessment(value, { ...input, interviewType: 'comprehensive' })
        .overallScore,
    ).toBe(78);
  });
  it('requires all answered questions and exact, nonduplicate evidence', () => {
    expect(() =>
      scoreAssessment(
        { ...raw(), questionAssessments: [item(1), excluded] },
        context,
      ),
    ).toThrow('覆盖');
    expect(() =>
      scoreAssessment(
        { ...raw(), questionAssessments: [item(1), item(1), excluded] },
        context,
      ),
    ).toThrow('重复');
    expect(() =>
      scoreAssessment(
        {
          ...raw(),
          questionAssessments: [
            { ...item(1), quote: '编造的经历' },
            item(2),
            excluded,
          ],
        },
        context,
      ),
    ).toThrow('原文');
    expect(() =>
      scoreAssessment(
        { ...raw(), questionAssessments: [item(1, 6), item(2), excluded] },
        context,
      ),
    ).toThrow();
    expect(() =>
      scoreAssessment(
        {
          ...raw(),
          questionAssessments: [
            item(1),
            item(2),
            { ...excluded, ratings: item(3).ratings },
          ],
        },
        context,
      ),
    ).toThrow('非计分');
  });
  it('does not manufacture scores from purely administrative dialogue', () => {
    const report = scoreAssessment(
      {
        overallComment: '只有反问，暂无能力评价',
        questionAssessments: [{ ...excluded, questionNumber: 1 }],
      },
      { ...context, qaList: [context.qaList[2]] },
    );
    expect(report.overallScore).toBeNull();
    expect(report.overallLevel).toBe('信息不足');
    expect(report.radarData).toEqual([]);
    expect(report.weaknesses).toEqual([]);
  });
});
