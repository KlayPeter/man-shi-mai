import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InterviewPreflight from '@/components/interview/InterviewPreflight'
import { useInterviewStore } from '@/stores/interviewStore'

const speech = vi.hoisted(() => ({ status: vi.fn() }))
vi.mock('@/api/interview-speech', () => ({ isInterviewSpeechConfigured: speech.status }))

describe('interview preflight speech availability', () => {
  let host: HTMLDivElement
  let root: Root
  const start = vi.fn()

  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
    vi.clearAllMocks()
    useInterviewStore.setState({ answerMode: 'voice', selectedPosition: { positionName: '前端工程师' } })
    host = document.createElement('div')
    document.body.append(host)
    root = createRoot(host)
  })
  afterEach(async () => {
    await act(async () => root.unmount())
    host.remove()
  })

  const render = async () => act(async () => {
    root.render(<InterviewPreflight type="special" remaining={1} onStart={start} />)
  })
  const button = (label: string) => [...host.querySelectorAll('button')].find(item => item.textContent?.includes(label))!

  it('offers text before charging when speech recognition is unconfigured', async () => {
    speech.status.mockResolvedValue(false)
    await render()
    expect(button('语音面试').disabled).toBe(true)
    expect(button('文字面试').getAttribute('aria-pressed')).toBe('true')
    expect(host.textContent).toContain('语音识别暂不可用')
    expect(useInterviewStore.getState().answerMode).toBe('text')
    await act(async () => button('正式开始面试').click())
    expect(start).toHaveBeenCalledOnce()
  })

  it('keeps voice available when the backend reports it configured', async () => {
    speech.status.mockResolvedValue(true)
    await render()
    expect(button('语音面试').disabled).toBe(false)
    expect(button('语音面试').getAttribute('aria-pressed')).toBe('true')
    expect(useInterviewStore.getState().answerMode).toBe('voice')
  })

  it('falls back to text when the capability check fails', async () => {
    speech.status.mockRejectedValue(new Error('offline'))
    await render()
    expect(button('语音面试').disabled).toBe(true)
    expect(useInterviewStore.getState().answerMode).toBe('text')
  })
})
