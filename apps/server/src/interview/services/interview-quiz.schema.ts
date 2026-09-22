import { z } from 'zod';

const question = z.object({
  question: z.string().trim().min(1).max(2000),
  answer: z.string().trim().min(1).max(12000),
  category: z.enum([
    'technical',
    'project',
    'problem-solving',
    'soft-skill',
    'behavioral',
    'scenario',
  ]),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  tips: z.string().optional(),
  keywords: z.array(z.string()).max(30).optional(),
  reasoning: z.string().optional(),
});

export const quizQuestions = z.object({
  questions: z.array(question).min(3).max(5),
  summary: z.string().trim().min(1).max(12000),
});

export const quizAnalysis = z.object({
  matchScore: z.number().min(0).max(100),
  matchLevel: z.string().trim().min(1).max(100),
  matchedSkills: z
    .array(
      z.object({
        skill: z.string(),
        matched: z.boolean(),
        proficiency: z.string().optional(),
      }),
    )
    .default([]),
  missingSkills: z.array(z.string()).default([]),
  knowledgeGaps: z.array(z.string()).default([]),
  learningPriorities: z
    .array(
      z.object({
        topic: z.string(),
        priority: z.enum(['high', 'medium', 'low']),
        reason: z.string(),
      }),
    )
    .default([]),
  radarData: z
    .array(
      z.object({
        dimension: z.string(),
        score: z.number().min(0).max(100),
        description: z.string().optional(),
      }),
    )
    .default([]),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  interviewTips: z.array(z.string()).default([]),
});

export const quizOutput = quizQuestions.merge(quizAnalysis);
export type QuizOutput = z.infer<typeof quizOutput>;
