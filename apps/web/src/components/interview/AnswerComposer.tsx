'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/ui/Icon'
import { InterviewRecorder, RECORDING_LIMIT_SECONDS, recordingError } from '@/lib/interview-recorder'
import { transcribeInterviewAudio, speechFailureMessage } from '@/api/interview-speech'

type VoiceState = 'idle' | 'requesting' | 'recording' | 'transcribing' | 'ready' | 'error'
interface Props { initialMode?: 'voice' | 'text'; value: string; onChange: (value: string) => void; onSend: (value: string) => void; disabled: boolean; onBeforeRecord: () => void }
export default function AnswerComposer({ value, onChange, onSend, disabled, onBeforeRecord, initialMode = 'voice' }: Props) {
  const [mode, setMode] = useState<'voice' | 'text'>(initialMode)
  const [state, setState] = useState<VoiceState>('idle')
  const [error, setError] = useState('')
  const [level, setLevel] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState('')
  const recorder = useRef<InterviewRecorder | null>(null)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const busyRef = useRef(false)
  const valueRef = useRef(value)
  const changeRef = useRef(onChange)
  valueRef.current = value; changeRef.current = onChange
  const busy = ['requesting', 'recording', 'transcribing'].includes(state)
  const cancel = () => {
    generation.current++; recorder.current?.cancel(); recorder.current = null
    request.current?.abort(); request.current = null; busyRef.current = false
  }
  useEffect(() => () => { generation.current++; recorder.current?.cancel(); request.current?.abort() }, [])
  useEffect(() => {
    if (!disabled) return
    generation.current++; recorder.current?.cancel(); recorder.current = null
    request.current?.abort(); request.current = null; busyRef.current = false; setState('idle')
  }, [disabled])
  useEffect(() => {
    if (!blob) { setAudioUrl(''); return }
    const url = URL.createObjectURL(blob); setAudioUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [blob])
  useEffect(() => {
    if (state !== 'recording') return
    const startedAt = Date.now()
    const timer = setInterval(() => setSeconds(Math.min(RECORDING_LIMIT_SECONDS, Math.floor((Date.now() - startedAt) / 1000))), 250)
    return () => clearInterval(timer)
  }, [state])

  const transcribe = async (audio: Blob, id: number) => {
    const controller = new AbortController(); request.current = controller
    setState('transcribing'); setError('')
    try {
      const text = await transcribeInterviewAudio(audio, controller.signal)
      if (generation.current !== id) return
      const current = valueRef.current.trim()
      changeRef.current(current ? `${current}\n${text}` : text)
      setState('ready'); busyRef.current = false
    } catch (failure) {
      if (generation.current !== id || controller.signal.aborted) return
      setError(speechFailureMessage(failure))
      setState('error'); busyRef.current = false
    } finally { if (request.current === controller) request.current = null }
  }
  const start = async () => {
    if (disabled || busyRef.current) return
    busyRef.current = true
    const id = ++generation.current
    setError(''); setBlob(null); setSeconds(0); setLevel(0); setState('requesting')
    onBeforeRecord()
    const session = new InterviewRecorder(setLevel); recorder.current = session
    try {
      await session.start()
      if (generation.current !== id) { session.cancel(); return }
      setState('recording')
      const audio = await session.result
      if (generation.current !== id) return
      recorder.current = null; setBlob(audio)
      await transcribe(audio, id)
    } catch (failure) {
      if (generation.current !== id) return
      session.cancel(); recorder.current = null
      setError(recordingError(failure)); setState('error'); busyRef.current = false
    }
  }
  const switchMode = (next: 'voice' | 'text') => {
    if (mode === next) return
    cancel(); setMode(next); setState('idle'); setError('')
  }
  const send = () => {
    if (disabled || busyRef.current || !value.trim()) return
    setBlob(null); setState('idle'); setError(''); onSend(value.trim())
  }
  return <section aria-label="本题回答" className="shrink-0 border-t border-line bg-white p-4 sm:px-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div role="group" aria-label="回答方式" className="flex gap-2">
        <button aria-pressed={mode === 'voice'} onClick={() => switchMode('voice')} className={`inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm ${mode === 'voice' ? 'bg-ink text-white' : 'text-muted hover:bg-paper'}`}><Icon name="i-heroicons-microphone" className="h-4 w-4" />语音回答</button>
        <button aria-pressed={mode === 'text'} onClick={() => switchMode('text')} className={`min-h-11 rounded-lg px-3 text-sm ${mode === 'text' ? 'bg-ink text-white' : 'text-muted hover:bg-paper'}`}>文字回答</button>
      </div>
      {mode === 'voice' && <p className="text-xs text-muted">录音 <span aria-hidden="true">→</span> 校对 <span aria-hidden="true">→</span> 发送</p>}
    </div>
    {mode === 'voice' && <div className="mb-3 rounded-xl border border-line bg-paper p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div aria-hidden="true" className="flex h-10 w-12 items-center justify-center gap-1 text-primary-700">
            {[0.55, 0.85, 1, 0.7, 0.4].map((factor, index) => <span key={index} className="w-1 rounded-full bg-current" style={{ height: state === 'recording' ? `${6 + level * factor * 30}px` : '6px' }} />)}
          </div>
          <div><p role="status" className="text-sm font-medium text-ink">{disabled ? '等待面试官提问' : state === 'requesting' ? '等待麦克风授权' : state === 'recording' ? '正在听你回答' : state === 'transcribing' ? '正在转成文字…' : state === 'ready' ? '校对后发送给面试官' : '准备好，就开始说'}</p>
            <p className="mt-1 text-xs text-muted">{state === 'recording' ? `${seconds}s / ${RECORDING_LIMIT_SECONDS}s` : `每段最多 ${RECORDING_LIMIT_SECONDS} 秒，可继续补充`}</p></div>
        </div>
        {state === 'recording' ? <button className="button-primary" onClick={() => recorder.current?.stop()}>我说完了</button>
          : <button className="button-secondary" disabled={disabled || busy} onClick={start}><Icon name="i-heroicons-microphone" className="h-4 w-4" />{value.trim() ? '补充一段' : '开始录音'}</button>}
      </div>
      {(state === 'requesting' || state === 'transcribing') && <button className="mt-2 min-h-11 text-sm text-primary-700" onClick={() => { cancel(); setState('idle') }}>取消，保留已有文字</button>}
      {audioUrl && !busy && <audio aria-label="本段录音回听" src={audioUrl} controls className="mt-3 h-10 w-full" />}
    </div>}
    {error && <div role="alert" className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}{blob && <button disabled={busy || disabled} className="ml-2 min-h-11 underline" onClick={() => { if (busyRef.current) return; busyRef.current = true; void transcribe(blob, ++generation.current) }}>重试转写</button>}</div>}
    <label htmlFor="interview-answer" className="mb-2 block text-sm font-medium text-ink">{mode === 'voice' ? '回答文字 · 可编辑' : '你的回答'}</label>
    <textarea id="interview-answer" value={value} onChange={event => onChange(event.target.value)} disabled={disabled || busy} rows={3}
      onKeyDown={event => { if (mode === 'text' && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send() } }}
      placeholder={disabled ? '等待面试官提问后回答' : '说完后校对，也可以直接输入…'} className="w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-base text-ink disabled:bg-paper" />
    <div className="mt-2 flex items-center justify-between gap-3"><span className="text-xs text-muted">{mode === 'voice' ? '确认发送后，面试官才会收到回答' : 'Enter 发送 · Shift+Enter 换行'}</span><button className="button-primary shrink-0" disabled={disabled || busy || !value.trim()} onClick={send}>发送回答<Icon name="i-heroicons-paper-airplane" className="h-4 w-4" /></button></div>
  </section>
}
