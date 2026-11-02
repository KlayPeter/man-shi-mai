import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'
import { useUserStore } from '@/stores/userStore'
const speech = vi.hoisted(() => ({ configured: vi.fn(), synthesize: vi.fn() }))
vi.mock('@/api/interview-speech', () => ({ isInterviewSynthesisConfigured: speech.configured, synthesizeInterviewSpeech: speech.synthesize }))
const players: FakeAudio[] = []
class FakeAudio {
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  play = vi.fn().mockResolvedValue(undefined)
  pause = vi.fn()
  removeAttribute = vi.fn()
  constructor(public src: string) { players.push(this) }
}
let root: Root, host: HTMLDivElement, api: ReturnType<typeof useSpeechSynthesis>
function Harness() { api = useSpeechSynthesis(); return null }
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  useUserStore.setState({ token: 'local-test-token' })
  vi.clearAllMocks(); players.length = 0
  speech.configured.mockResolvedValue(true)
  speech.synthesize.mockResolvedValue(new Blob(['synthetic'], { type: 'audio/wav' }))
  vi.stubGlobal('Audio', FakeAudio)
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:local'), revokeObjectURL: vi.fn() }))
  host = document.createElement('div'); root = createRoot(host)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => {
  await act(async () => root.unmount())
  useUserStore.setState({ token: '' }); vi.unstubAllGlobals()
})
describe('cloud interviewer playback', () => {
  it('plays cloud audio serially and releases each object URL', async () => {
    expect(api.source).toBe('cloud')
    await act(async () => api.handleStreamText('第一句。第二句。', true))
    expect(speech.synthesize).toHaveBeenCalledTimes(1)
    expect(players).toHaveLength(1)
    await act(async () => players[0].onended?.())
    expect(speech.synthesize).toHaveBeenCalledTimes(2)
    expect(players[0].pause).toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:local')
    await act(async () => api.stop())
    expect(players[1].pause).toHaveBeenCalled()
  })
  it('aborts synthesis before recording and ignores a late response', async () => {
    let resolve!: (blob: Blob) => void
    speech.synthesize.mockReturnValueOnce(new Promise(done => { resolve = done }))
    await act(async () => api.handleStreamText('请介绍你自己。', true))
    const signal = speech.synthesize.mock.calls[0][1] as AbortSignal
    await act(async () => api.stop())
    expect(signal.aborted).toBe(true)
    await act(async () => resolve(new Blob(['late'])))
    expect(players).toHaveLength(0)
  })
  it('shows a playback failure without advancing to the next question audio', async () => {
    await act(async () => api.handleStreamText('第一句。第二句。', true))
    await act(async () => players[0].onerror?.())
    expect(api.error).toContain('重听')
    expect(api.isSpeaking).toBe(false)
    expect(speech.synthesize).toHaveBeenCalledTimes(1)
  })
})
