import request from '@/lib/request'
import { MAX_RECORDING_BYTES } from '@/lib/interview-recorder'

export function audioToBase64(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    const cleanup = () => signal.removeEventListener('abort', abort)
    const abort = () => { reader.abort(); cleanup(); reject(new DOMException('已取消转写', 'AbortError')) }
    if (signal.aborted) { abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    reader.onerror = () => { cleanup(); reject(new Error('无法读取录音，请重试。')) }
    reader.onload = () => {
      cleanup()
      const result = typeof reader.result === 'string' ? reader.result.split(',')[1] : undefined
      if (!result) reject(new Error('录音内容为空，请重新录制。'))
      else resolve(result)
    }
    try { reader.readAsDataURL(blob) } catch { cleanup(); reject(new Error('无法读取录音，请重试。')) }
  })
}
export async function transcribeInterviewAudio(blob: Blob, signal: AbortSignal): Promise<string> {
  if (!blob.size || blob.size > MAX_RECORDING_BYTES) throw new Error('录音大小不符合要求，请重新录制。')
  const audio = await audioToBase64(blob, signal)
  const result = await request.post<unknown, unknown>('/interview/speech-to-text', { audio }, { signal, timeout: 30000 })
  if (!result || typeof result !== 'object' || !('text' in result) || typeof result.text !== 'string' || !result.text.trim()) throw new Error('没有识别到清晰语音，可以重试转写或直接输入。')
  return result.text.trim()
}
