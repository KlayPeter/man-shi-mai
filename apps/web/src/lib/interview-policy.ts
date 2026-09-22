export type PracticeIntensity = 'warmup' | 'standard' | 'challenge'

export const PRACTICE_OPTIONS: { value: PracticeIntensity; label: string; durationMinutes: number; maxAnswers: number; description: string }[] = [
  { value: 'warmup', label: '热身', durationMinutes: 15, maxAnswers: 6, description: '先开口，问题更聚焦' },
  { value: 'standard', label: '标准', durationMinutes: 30, maxAnswers: 12, description: '完整模拟，按回答追问' },
  { value: 'challenge', label: '挑战', durationMinutes: 45, maxAnswers: 18, description: '深入追问取舍与证据' },
]

export function isPracticeIntensity(value: unknown): value is PracticeIntensity {
  return value === 'warmup' || value === 'standard' || value === 'challenge'
}
