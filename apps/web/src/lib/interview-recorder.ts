export const RECORDING_LIMIT_SECONDS = 55
export const MAX_RECORDING_BYTES = 4 * 1024 * 1024

/** One owned microphone session. Cancellation also handles late permission grants. */
export class InterviewRecorder {
  private cancelled = false
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private context: AudioContext | null = null
  private frame: number | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private chunks: Blob[] = []
  private bytes = 0
  private startedAt = 0
  private settled = false
  private resolve?: (blob: Blob) => void
  private reject?: (error: Error) => void
  readonly result: Promise<Blob>

  constructor(private readonly onLevel: (level: number) => void) {
    this.result = new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject })
    // Permission can fail before the consumer begins awaiting the recording.
    void this.result.catch(() => undefined)
  }
  async start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') throw new Error('当前环境不支持录音，请使用 HTTPS 或切换文字回答。')
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
    if (this.cancelled) { stream.getTracks().forEach(track => track.stop()); throw new DOMException('已取消录音', 'AbortError') }
    this.stream = stream
    try {
      const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType, audioBitsPerSecond: 64000 } : undefined)
      this.recorder = recorder
      recorder.ondataavailable = event => {
        if (this.cancelled || this.settled || !event.data.size) return
        this.bytes += event.data.size
        if (this.bytes > MAX_RECORDING_BYTES) { this.finish(new Error('这段录音过大，请缩短后重新录制。')); return }
        this.chunks.push(event.data)
      }
      recorder.onerror = () => this.finish(new Error('录音中断，请检查麦克风或切换文字回答。'))
      recorder.onstop = () => {
        if (this.cancelled || this.settled) return
        if (Date.now() - this.startedAt > 59000) { this.finish(new Error('录音超时，请重新录制较短的一段。')); return }
        const blob = new Blob(this.chunks, { type: recorder.mimeType || mimeType || 'audio/webm' })
        this.finish(blob.size ? blob : new Error('没有收到录音，请检查麦克风后重试。'))
      }
      for (const track of stream.getTracks()) track.onended = () => this.stop()
      recorder.start(1000)
      this.startedAt = Date.now()
      this.timer = setTimeout(() => this.stop(), RECORDING_LIMIT_SECONDS * 1000)
      // A level meter is optional; its failure must not discard a working microphone.
      try {
        this.context = new AudioContext()
        const analyser = this.context.createAnalyser()
        analyser.fftSize = 256
        this.context.createMediaStreamSource(stream).connect(analyser)
        const values = new Uint8Array(analyser.fftSize)
        const tick = () => {
          if (this.cancelled || this.settled) return
          analyser.getByteTimeDomainData(values)
          const rms = Math.sqrt(values.reduce((sum, value) => sum + ((value - 128) / 128) ** 2, 0) / values.length)
          this.onLevel(Math.min(1, rms * 4))
          this.frame = requestAnimationFrame(tick)
        }
        tick()
      } catch { /* Recording remains available without a visual level meter. */ }
    } catch (error) {
      this.cancel()
      throw error
    }
  }
  stop() {
    if (this.recorder?.state === 'recording') this.recorder.stop()
  }
  cancel() {
    this.cancelled = true
    this.finish(new DOMException('已取消录音', 'AbortError'))
  }
  private finish(value: Blob | Error) {
    if (this.settled) return
    this.settled = true
    if (this.timer) clearTimeout(this.timer)
    if (this.frame !== null) cancelAnimationFrame(this.frame)
    if (this.recorder) {
      this.recorder.ondataavailable = null; this.recorder.onstop = null; this.recorder.onerror = null
      if (this.recorder.state !== 'inactive') this.recorder.stop()
    }
    this.stream?.getTracks().forEach(track => { track.onended = null; track.stop() })
    if (this.context && this.context.state !== 'closed') void this.context.close().catch(() => undefined)
    this.stream = null; this.context = null; this.chunks = []
    if (value instanceof Blob) this.resolve?.(value)
    else this.reject?.(value)
  }
}

export function recordingError(error: unknown): string {
  if (error instanceof Error && error.name === 'NotAllowedError') return '麦克风未获授权。允许访问后可重试，也可以直接输入回答。'
  if (error instanceof Error && error.name === 'NotFoundError') return '没有找到麦克风，可以直接输入回答。'
  if (error instanceof Error && error.name === 'NotSupportedError') return '当前浏览器无法录音，请更换浏览器或使用文字回答。'
  if (error instanceof Error && error.name === 'NotReadableError') return '麦克风可能被其他应用占用，请关闭占用后重试。'
  return error instanceof Error ? error.message : '录音失败，请重试或切换文字回答。'
}
