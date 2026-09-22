import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { InterviewRecorder } from '@/lib/interview-recorder'

class RecorderMock {
  static isTypeSupported = () => true
  static current: RecorderMock
  mimeType = 'audio/webm'
  state = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: (() => void) | null = null
  constructor() { RecorderMock.current = this }
  start() { this.state = 'recording' }
  stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['recording']) }); this.onstop?.() }
}
const track = { stop: vi.fn(), onended: null }
const stream = { getTracks: () => [track] }
const getUserMedia = vi.fn()
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('MediaRecorder', RecorderMock)
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  getUserMedia.mockResolvedValue(stream); track.stop.mockClear()
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
describe('microphone ownership', () => {
  it('late permission grant after cancellation stops all tracks', async () => {
    let grant: (value: typeof stream) => void = () => undefined
    getUserMedia.mockReturnValue(new Promise(resolve => { grant = resolve }))
    const recorder = new InterviewRecorder(() => undefined)
    const pending = recorder.start(); recorder.cancel(); grant(stream)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(track.stop).toHaveBeenCalledOnce()
  })
  it('stopping produces one blob and releases tracks', async () => {
    const recorder = new InterviewRecorder(() => undefined)
    await recorder.start(); recorder.stop(); recorder.stop()
    expect((await recorder.result).size).toBeGreaterThan(0)
    expect(track.stop).toHaveBeenCalledOnce()
  })
  it('auto stops at 55 seconds; cancellation does not upload a recording', async () => {
    const recorder = new InterviewRecorder(() => undefined)
    await recorder.start(); await vi.advanceTimersByTimeAsync(55000)
    expect((await recorder.result).size).toBeGreaterThan(0)
    const cancelled = new InterviewRecorder(() => undefined)
    await cancelled.start(); cancelled.cancel()
    await expect(cancelled.result).rejects.toMatchObject({ name: 'AbortError' })
    expect(track.stop).toHaveBeenCalledTimes(2)
  })
  it('unsupported devices fail with actionable text', async () => {
    vi.stubGlobal('MediaRecorder', undefined)
    const recorder = new InterviewRecorder(() => undefined)
    await expect(recorder.start()).rejects.toThrow('切换文字回答')
    recorder.cancel()
  })
})
