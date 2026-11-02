import { z } from 'zod';
import {
  DIMENSIONS,
  questionAssessmentSchema,
  RATING_ANCHORS,
  rubricOutputSchema,
  rubricWeights,
  scoreLevel,
  weightedScore,
} from './assessment-rubric';

export const ASSESSMENT_VERSION = 'interview-rubric-v2';
const score = z.number().min(0).max(100);
export const assessmentOutputSchema = z.object({
  overallScore: score.nullable(),
  overallLevel: z.string().min(1),
  overallComment: z.string().min(1),
  radarData: z.array(
    z.object({
      dimension: z.string().min(1),
      score,
      description: z.string().min(1),
    }),
  ),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  improvements: z.array(
    z.object({
      category: z.string(),
      suggestion: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ),
  // 文本转写无法评估真实语速/音色，未观测的维度使用 null。
  fluencyScore: z.null(),
  logicScore: score.nullable(),
  professionalScore: score.nullable(),
  questionAssessments: z
    .array(questionAssessmentSchema.extend({ score: score.nullable() }))
    .optional(),
  scoring: z
    .object({
      scoredQuestions: z.number().int().min(0),
      answeredQuestions: z.number().int().min(0),
      weights: z.array(
        z.object({
          key: z.enum(['relevance', 'correctness', 'depth', 'structure']),
          label: z.string(),
          weight: z.number().min(0).max(100),
        }),
      ),
    })
    .optional(),
  evidence: z
    .array(
      z.object({
        questionNumber: z.number().int().min(1),
        quote: z.string().trim().min(1),
        kind: z.enum(['strength', 'improvement']),
        feedback: z.string().trim().min(1),
        practice: z.string().trim().min(1),
      }),
    )
    .min(1),
});
export type AssessmentOutput = z.infer<typeof assessmentOutputSchema>;
export interface AssessmentContext {
  interviewType: 'special' | 'comprehensive';
  company: string;
  positionName: string;
  jd: string;
  resumeContent: string;
  qaList: Array<{ question: string; answer: string; standardAnswer?: string }>;
}
export function validateAssessment(
  value: unknown,
  answers: string[],
): AssessmentOutput {
  const result = assessmentOutputSchema.parse(value);
  for (const item of result.evidence) {
    const answer = answers[item.questionNumber - 1];
    if (!answer || !answer.includes(item.quote))
      throw new Error('报告引用与回答原文不一致');
  }
  return result;
}

/** 模型判断证据等级；单题分数、总分与等级统一由服务端计算。 */
export function scoreAssessment(
  value: unknown,
  context: AssessmentContext,
): AssessmentOutput {
  const parsed = rubricOutputSchema.parse(value);
  const weights = rubricWeights(context.interviewType);
  const answered = context.qaList.flatMap((qa, index) =>
    qa.answer.trim() ? [index + 1] : [],
  );
  const seen = new Set<number>();
  const questionAssessments = parsed.questionAssessments.map((item) => {
    const answer = context.qaList[item.questionNumber - 1]?.answer;
    if (
      seen.has(item.questionNumber) ||
      !answer?.trim() ||
      !answer.includes(item.quote)
    ) {
      throw new Error('逐题评分缺失、重复或引用与回答原文不一致');
    }
    seen.add(item.questionNumber);
    if (
      item.excludedReason &&
      Object.values(item.ratings).some((rating) => rating !== null)
    ) {
      throw new Error('非计分题不能包含能力评分');
    }
    if (!item.excludedReason && item.ratings.relevance === null) {
      throw new Error('计分题必须评价切题性');
    }
    return {
      ...item,
      score: item.excludedReason ? null : weightedScore(item.ratings, weights),
    };
  });
  if (
    seen.size !== answered.length ||
    answered.some((number) => !seen.has(number))
  ) {
    throw new Error('逐题评分必须覆盖每条已回答的问题');
  }
  const scored = questionAssessments.filter((item) => item.score !== null);
  const overallScore = scored.length
    ? Math.round(
        scored.reduce((sum, item) => sum + item.score!, 0) / scored.length,
      )
    : null;
  const radarData = DIMENSIONS.flatMap((dimension) => {
    const values = scored.flatMap((item) =>
      item.ratings[dimension.key] === null
        ? []
        : [RATING_ANCHORS[item.ratings[dimension.key]! - 1].score],
    );
    return values.length
      ? [
          {
            dimension: dimension.label,
            score: Math.round(
              values.reduce((sum, value) => sum + value, 0) / values.length,
            ),
            description: `基于 ${values.length} 道有观察依据的回答；未观察部分不计分。`,
          },
        ]
      : [];
  });
  const evidence = (scored.length ? scored : questionAssessments).map(
    (item) => ({
      questionNumber: item.questionNumber,
      quote: item.quote,
      kind:
        item.score !== null && item.score >= 80
          ? ('strength' as const)
          : ('improvement' as const),
      feedback: item.excludedReason
        ? `本题为${item.excludedReason === 'candidate_questions' ? '候选人反问' : '流程性对话'}，不计入能力评分。`
        : item.feedback,
      practice: item.practice,
    }),
  );
  return validateAssessment(
    {
      overallScore,
      overallLevel: scoreLevel(overallScore),
      overallComment: parsed.overallComment,
      radarData,
      questionAssessments,
      scoring: {
        scoredQuestions: scored.length,
        answeredQuestions: answered.length,
        weights,
      },
      strengths: evidence
        .filter((item) => item.kind === 'strength')
        .map((item) => item.feedback),
      weaknesses: scored.length
        ? evidence
            .filter((item) => item.kind === 'improvement')
            .map((item) => item.feedback)
        : [],
      improvements: scored.length
        ? evidence
            .filter((item) => item.kind === 'improvement')
            .map((item) => ({
              category: `第 ${item.questionNumber} 题`,
              suggestion: item.practice,
              priority: 'high',
            }))
        : [],
      fluencyScore: null,
      logicScore:
        radarData.find((item) => item.dimension === '表达与结构')?.score ??
        null,
      professionalScore:
        radarData.find((item) => item.dimension === '方法与判断')?.score ??
        null,
      evidence,
    },
    context.qaList.map((qa) => qa.answer),
  );
}
