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

export function speechFailureMessage(error: unknown): string {
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object'
  const status = record(error) && record(error.response) ? error.response.status : undefined
  const messages: Record<number, string> = {
    400: '录音格式、大小或时长不符合要求，请重新录制较短的一段。',
    401: '登录已过期，请重新登录后再试。',
    422: '没有识别到清晰语音，请回听检查，或切换文字回答。',
    429: '语音请求过于频繁，请稍后重试。',
    502: '语音服务暂时异常，可以稍后重试或使用文字回答。',
    503: '语音服务暂不可用或繁忙，请稍后重试或使用文字回答。',
    504: '语音识别超时，可以重试转写或使用文字回答。',
  }
  const reason = typeof status === 'number' ? messages[status] : undefined
  return `${reason || '转写未完成，可以重试转写或直接输入回答。'} 录音已保留。`
}
