import { beforeEach, describe, expect, it, vi } from 'vitest'
const get = vi.hoisted(() => vi.fn())
vi.mock('@/lib/request', () => ({ default: { get } }))
import { useResumeStudioStore } from '@/stores/resumeStudioStore'

describe('resume detail recovery', () => {
  beforeEach(() => { get.mockReset(); useResumeStudioStore.setState({ currentResume: null, isLoading: false, loadError: '' }) })
  it('ends loading with a visible error and clears it after a successful retry', async () => {
    get.mockRejectedValueOnce(new Error('unavailable'))
    await useResumeStudioStore.getState().fetchResumeDetail('synthetic')
    expect(useResumeStudioStore.getState().isLoading).toBe(false)
    expect(useResumeStudioStore.getState().loadError).toContain('请重试')
    get.mockResolvedValueOnce({ _id: 'synthetic', sourceType: 'upload' })
    await useResumeStudioStore.getState().fetchResumeDetail('synthetic')
    expect(useResumeStudioStore.getState().loadError).toBe('')
    expect(useResumeStudioStore.getState().currentResume?._id).toBe('synthetic')
  })
})
