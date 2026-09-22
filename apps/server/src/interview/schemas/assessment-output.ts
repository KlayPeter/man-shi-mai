import { z } from 'zod';

export const ASSESSMENT_VERSION = 'interview-evidence-v1';
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
