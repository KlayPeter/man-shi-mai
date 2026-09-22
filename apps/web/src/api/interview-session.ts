import request from '@/lib/request'

export interface RecoveredInterview {
  resultId: string
  sessionId: string
  interviewerName: string
  status: 'in_progress' | 'paused' | 'completed'
  questionVersion: number
  busyUntil: string | null
  committedRequestId: string | null
  conversationHistory: { role: 'interviewer' | 'candidate'; content: string; timestamp: string }[]
}

export function parseRecoveredInterview(value: unknown): RecoveredInterview {
  if (!value || typeof value !== 'object') throw new Error('会话响应无效')
  const data = value as Record<string, unknown>
  if (typeof data.resultId !== 'string' || typeof data.sessionId !== 'string' ||
    typeof data.interviewerName !== 'string' || !['in_progress', 'paused', 'completed'].includes(String(data.status)) ||
    !Number.isInteger(data.questionVersion) || Number(data.questionVersion) < 0 ||
    !(data.busyUntil === null || (typeof data.busyUntil === 'string' && Number.isFinite(Date.parse(data.busyUntil)))) ||
    !(data.committedRequestId === null || typeof data.committedRequestId === 'string') ||
    !Array.isArray(data.conversationHistory) || !data.conversationHistory.every((item: unknown) => {
      if (!item || typeof item !== 'object') return false
      const message = item as Record<string, unknown>
      return ['interviewer', 'candidate'].includes(String(message.role)) && typeof message.content === 'string' &&
        typeof message.timestamp === 'string' && Number.isFinite(Date.parse(message.timestamp))
    })) throw new Error('会话响应不完整，请稍后重试')
  return data as unknown as RecoveredInterview
}

export async function recoverInterview(resultId: string, signal?: AbortSignal): Promise<RecoveredInterview> {
  const response: unknown = await request.post(`/interview/mock/resume/${encodeURIComponent(resultId)}`, {}, { signal })
  const recovered = parseRecoveredInterview(response)
  if (recovered.resultId !== resultId) throw new Error('返回了不同场次的会话')
  return recovered
}
