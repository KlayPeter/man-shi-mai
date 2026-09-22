export enum PracticeIntensity {
  WARMUP = 'warmup',
  STANDARD = 'standard',
  CHALLENGE = 'challenge',
}

export const INTERVIEW_POLICIES = {
  warmup: {
    durationMinutes: 15,
    maxAnswers: 6,
    maxQuestionsPerPhase: 1,
    guidance:
      '热身练习：语气耐心，一次只问一个具体问题；可以给简短的回答结构提示，不代写答案，不即时评分。',
  },
  standard: {
    durationMinutes: 30,
    maxAnswers: 12,
    maxQuestionsPerPhase: 2,
    guidance:
      '标准模拟：专业、中性，每次只问一个问题；结合已说内容澄清或追问，不提供答案或即时评分，反馈留到复盘。',
  },
  challenge: {
    durationMinutes: 45,
    maxAnswers: 18,
    maxQuestionsPerPhase: 3,
    guidance:
      '挑战模拟：每次只问一个更深入的问题，追问取舍、证据与边界；尊重候选人，不羞辱、不虚构矛盾，不提供答案或即时评分，反馈留到复盘。',
  },
} as const;

export function interviewPolicy(
  intensity: PracticeIntensity = PracticeIntensity.STANDARD,
) {
  return INTERVIEW_POLICIES[intensity];
}
