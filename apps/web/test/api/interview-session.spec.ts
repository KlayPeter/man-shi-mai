import { describe, it, expect, vi } from 'vitest'
const http = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/request', () => ({ default: http }))
import { parseRecoveredInterview, recoverInterview } from '@/api/interview-session'
import { useInterviewStore } from '@/stores/interviewStore'
const response = { resultId: 'result', sessionId: 'session', interviewerName: '面试官', status: 'in_progress', questionVersion: 2, busyUntil: null, committedRequestId: null,
  conversationHistory: [{ role: 'interviewer', content: '请介绍项目', timestamp: new Date().toISOString() }] }
describe('session recovery', () => {
  it('uses the resume endpoint and checks the restored identity', async () => {
    http.post.mockResolvedValue(response)
    expect((await recoverInterview('result')).questionVersion).toBe(2)
    expect(http.post).toHaveBeenCalledWith('/interview/mock/resume/result', {}, { signal: undefined })
    await expect(recoverInterview('other')).rejects.toThrow('不同场次')
  })
  it('rejects old raw snapshots and malformed versions/messages', () => {
    for (const data of [{ sessionState: {} }, { ...response, questionVersion: -1 }, { ...response, busyUntil: 'bad date' }, { ...response, conversationHistory: [{ role: 'system', content: 'x', timestamp: 'bad' }] }]) {
      expect(() => parseRecoveredInterview(data)).toThrow()
    }
  })
  it('keeps a retry id with the draft and clears both when starting over', () => {
    useInterviewStore.setState({ answerDraft: '我的回答', pendingAnswer: { requestId: 'same-id', expectedVersion: 2, answer: '我的回答' }, questionVersion: 2 })
    expect(useInterviewStore.getState().pendingAnswer?.requestId).toBe('same-id')
    useInterviewStore.getState().resetInterview()
    expect(useInterviewStore.getState().answerDraft).toBe('')
    expect(useInterviewStore.getState().pendingAnswer).toBeNull()
    expect(useInterviewStore.getState().questionVersion).toBe(0)
  })
})
