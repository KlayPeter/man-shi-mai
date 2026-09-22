import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import AnswerComposer from '@/components/interview/AnswerComposer'
const speech = vi.hoisted(() => ({ status: vi.fn(), transcribe: vi.fn() }))
vi.mock('@/api/interview-speech', () => ({ isInterviewSpeechConfigured: speech.status, transcribeInterviewAudio: speech.transcribe, speechFailureMessage: () => '转写失败，录音已保留' }))
const recorder = vi.hoisted(() => ({ start: vi.fn(), cancel: vi.fn(), stop: vi.fn(), result: Promise.resolve(new Blob(['audio'])) }))
vi.mock('@/lib/interview-recorder', () => ({ RECORDING_LIMIT_SECONDS: 55, InterviewRecorder: class { start = recorder.start; cancel = recorder.cancel; stop = recorder.stop; result = recorder.result }, recordingError: () => '麦克风未获授权，可以直接输入回答。' }))
let host: HTMLDivElement, root: Root
const onSend = vi.fn()
function Harness() { const [value, setValue] = useState('已有草稿'); return <AnswerComposer value={value} onChange={setValue} onSend={onSend} disabled={false} onBeforeRecord={() => undefined} /> }
const button = (text: string) => [...host.querySelectorAll('button')].find(item => item.textContent?.includes(text))!
const click = async (text: string) => act(async () => { button(text).click() })
beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() }))
  vi.clearAllMocks(); recorder.start.mockResolvedValue(undefined)
  speech.status.mockResolvedValue(true)
  speech.transcribe.mockResolvedValue('识别的补充回答')
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  await act(async () => root.render(<Harness />))
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals() })
describe('inline voice answer', () => {
  it('returns to text without recording when speech is unavailable in a resumed session', async () => {
    await act(async () => root.unmount())
    root = createRoot(host)
    speech.status.mockResolvedValue(false)
    await act(async () => root.render(<Harness />))
    expect(button('语音回答').disabled).toBe(true)
    expect(host.textContent).toContain('语音识别暂不可用')
    await click('发送回答')
    expect(onSend).toHaveBeenCalledWith('已有草稿')
    expect(recorder.start).not.toHaveBeenCalled()
  })
  it('waits for recognition, appends to the draft, and sends only on confirmation', async () => {
    let resolve: (text: string) => void = () => undefined
    speech.transcribe.mockReturnValue(new Promise(done => { resolve = done }))
    await click('补充一段')
    expect(host.textContent).toContain('正在转成文字')
    expect(button('发送回答').disabled).toBe(true)
    expect(onSend).not.toHaveBeenCalled()
    await act(async () => { resolve('新的内容') })
    expect(host.querySelector('textarea')!.value).toBe('已有草稿\n新的内容')
    await click('发送回答')
    expect(onSend).toHaveBeenCalledWith('已有草稿\n新的内容')
  })
  it('failed recognition keeps the draft and retries the same recording once', async () => {
    speech.transcribe.mockRejectedValueOnce(new Error('offline'))
    await click('补充一段')
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('录音已保留')
    expect(host.querySelector('textarea')!.value).toBe('已有草稿')
    await click('重试转写')
    expect(speech.transcribe).toHaveBeenCalledTimes(2)
    expect(host.querySelector('textarea')!.value).toBe('已有草稿\n识别的补充回答')
  })
  it('switching to text cancels late results without replacing the draft', async () => {
    let resolve: (text: string) => void = () => undefined
    speech.transcribe.mockReturnValue(new Promise(done => { resolve = done }))
    await click('补充一段')
    const signal = speech.transcribe.mock.calls[0][1] as AbortSignal
    await click('文字回答')
    expect(signal.aborted).toBe(true)
    await act(async () => { resolve('已取消的内容') })
    expect(host.querySelector('textarea')!.value).toBe('已有草稿')
    expect(button('发送回答').disabled).toBe(false)
  })
  it('permission failure leaves the text escape route usable', async () => {
    recorder.start.mockRejectedValueOnce(new DOMException('denied', 'NotAllowedError'))
    await click('补充一段')
    expect(host.querySelector('[role="alert"]')?.textContent).toContain('麦克风未获授权')
    await click('文字回答'); await click('发送回答')
    expect(onSend).toHaveBeenCalledWith('已有草稿')
  })
})
