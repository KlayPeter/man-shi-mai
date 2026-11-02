import { z } from 'zod';

export const RATING_ANCHORS = [
  { rating: 1, score: 20, label: '未切题或关键错误' },
  { rating: 2, score: 45, label: '部分相关，核心缺口较大' },
  { rating: 3, score: 65, label: '基本正确，仍需补充' },
  { rating: 4, score: 85, label: '正确具体，解释清楚' },
  { rating: 5, score: 100, label: '准确深入，兼顾边界与取舍' },
] as const;

export const DIMENSIONS = [
  { key: 'relevance', label: '切题与覆盖' },
  { key: 'correctness', label: '方法与判断' },
  { key: 'depth', label: '深度与依据' },
  { key: 'structure', label: '表达与结构' },
] as const;
export type DimensionKey = (typeof DIMENSIONS)[number]['key'];
const rating = z.number().int().min(1).max(5).nullable();
export const ratingsSchema = z.object({
  relevance: rating,
  correctness: rating,
  depth: rating,
  structure: rating,
});
export const questionAssessmentSchema = z.object({
  questionNumber: z.number().int().min(1),
  excludedReason: z.enum(['candidate_questions', 'administrative']).nullable(),
  ratings: ratingsSchema,
  quote: z.string().trim().min(1),
  feedback: z.string().trim().min(1),
  practice: z.string().trim().min(1),
});
export const rubricOutputSchema = z.object({
  overallComment: z.string().trim().min(1),
  questionAssessments: z.array(questionAssessmentSchema).min(1),
});
export type QuestionAssessment = z.infer<typeof questionAssessmentSchema> & {
  score: number | null;
};

export function rubricWeights(type: 'special' | 'comprehensive') {
  const weights =
    type === 'special'
      ? { relevance: 30, correctness: 35, depth: 20, structure: 15 }
      : { relevance: 25, correctness: 20, depth: 35, structure: 20 };
  return DIMENSIONS.map((item) => ({ ...item, weight: weights[item.key] }));
}

export function weightedScore(
  ratings: z.infer<typeof ratingsSchema>,
  weights: ReturnType<typeof rubricWeights>,
): number | null {
  let total = 0;
  let weight = 0;
  for (const item of weights) {
    const value = ratings[item.key];
    if (value === null) continue;
    total += RATING_ANCHORS[value - 1].score * item.weight;
    weight += item.weight;
  }
  return weight ? Math.round(total / weight) : null;
}

export function scoreLevel(score: number | null) {
  return score === null
    ? '信息不足'
    : score >= 90
      ? '优秀'
      : score >= 80
        ? '良好'
        : score >= 60
          ? '基本达标'
          : '需加强';
}
