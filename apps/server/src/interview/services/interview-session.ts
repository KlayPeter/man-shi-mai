import { z } from 'zod';
import { MockInterviewType } from '../dto/mock-interview.dto';

export const interviewPhase = z.enum([
  'introduction',
  'resume_digging',
  'tech_assessment',
  'behavioral_test',
  'candidate_qa',
  'closing',
]);

// Mixed 历史数据也必须通过边界校验；日期从 JSON / Mongo 恢复为 Date。
export const interviewSession = z.object({
  sessionId: z.string().min(1),
  resultId: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  consumptionRecordId: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  userId: z.string().min(1),
  interviewType: z.nativeEnum(MockInterviewType),
  interviewerName: z.string(),
  candidateName: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  company: z.string(),
  positionName: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  salaryRange: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  jd: z
    .string()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  resumeContent: z.string(),
  conversationHistory: z.array(
    z.object({
      role: z.enum(['interviewer', 'candidate']),
      content: z.string(),
      timestamp: z.coerce.date(),
      standardAnswer: z
        .string()
        .nullish()
        .transform((value) => value ?? undefined)
        .optional(),
    }),
  ),
  questionCount: z.number().int().nonnegative(),
  startTime: z.coerce.date(),
  targetDuration: z.number().positive(),
  isActive: z.boolean(),
  currentPhase: interviewPhase
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  questionsAskedCount: z
    .number()
    .int()
    .nonnegative()
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
  extractedSkills: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? undefined)
    .optional(),
});
export type InterviewSession = z.infer<typeof interviewSession>;

export const generatedTurn = z.object({
  question: z.string().trim().min(1).max(20000),
  shouldEnd: z.boolean(),
  standardAnswer: z.string().optional(),
  metadata: z
    .object({
      currentPhase: interviewPhase.optional(),
      questionsAskedCount: z.number().int().nonnegative().optional(),
      extractedSkills: z.array(z.string()).optional(),
    })
    .optional(),
});
