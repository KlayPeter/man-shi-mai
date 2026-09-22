import { describe, it, expect, vi } from 'vitest'
const http = vi.hoisted(() => ({ post: vi.fn() }))
vi.mock('@/lib/request', () => ({ default: http }))
import { audioToBase64, transcribeInterviewAudio } from '@/api/interview-speech'

describe('speech upload boundary', () => {
  it('awaits FileReader and passes cancellation into the shared HTTP client', async () => {
    http.post.mockResolvedValueOnce({ text: '  转写文字  ' })
    const controller = new AbortController()
    await expect(transcribeInterviewAudio(new Blob(['sample']), controller.signal)).resolves.toBe('转写文字')
    expect(http.post).toHaveBeenLastCalledWith('/interview/speech-to-text', { audio: 'c2FtcGxl' }, { signal: controller.signal, timeout: 30000 })
  })
  it('rejects empty audio, pre-cancelled reads and malformed responses', async () => {
    const controller = new AbortController()
    await expect(transcribeInterviewAudio(new Blob([]), controller.signal)).rejects.toThrow('录音大小')
    controller.abort()
    await expect(audioToBase64(new Blob(['sample']), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    http.post.mockResolvedValueOnce({ text: '' })
    await expect(transcribeInterviewAudio(new Blob(['sample']), new AbortController().signal)).rejects.toThrow('没有识别到清晰语音')
  })
  it('network errors remain rejected so the UI can retain the recording and retry', async () => {
    http.post.mockRejectedValueOnce(new Error('offline'))
    await expect(transcribeInterviewAudio(new Blob(['sample']), new AbortController().signal)).rejects.toThrow('offline')
  })
})
