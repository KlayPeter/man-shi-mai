'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, FileText, Mic, MessageSquare, Volume2 } from 'lucide-react'
import { useInterviewStore } from '@/stores/interviewStore'
import { PRACTICE_OPTIONS } from '@/lib/interview-policy'
import { InterviewRecorder, recordingError } from '@/lib/interview-recorder'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'

export default function InterviewPreflight({ type, remaining, onStart }: {
  type: 'special' | 'behavior'; remaining?: number; onStart: () => void
}) {
  const position = useInterviewStore(s => s.selectedPosition)
  const hasResume = useInterviewStore(s => !!(s.resumeId || s.resumeText.trim()))
  const answerMode = useInterviewStore(s => s.answerMode)
  const practiceIntensity = useInterviewStore(s => s.practiceIntensity)
  const [state, setState] = useState<'idle' | 'requesting' | 'recording' | 'ready'>('idle')
  const [error, setError] = useState('')
  const [level, setLevel] = useState(0)
  const [audio, setAudio] = useState<Blob | null>(null)
  const [url, setUrl] = useState('')
  const recorder = useRef<InterviewRecorder | null>(null)
  const generation = useRef(0)
  const sound = useSpeechSynthesis()
  useEffect(() => () => { generation.current++; recorder.current?.cancel() }, [])
  useEffect(() => {
    if (!audio) { setUrl(''); return }
    const src = URL.createObjectURL(audio); setUrl(src)
    return () => URL.revokeObjectURL(src)
  }, [audio])
  const cancel = () => { generation.current++; recorder.current?.cancel(); recorder.current = null; setState('idle'); sound.stop() }
  const testMic = async () => {
    if (recorder.current) return
    const id = ++generation.current
    const session = new InterviewRecorder(setLevel); recorder.current = session
    sound.stop(); setError(''); setAudio(null); setState('requesting')
    try {
      await session.start()
      if (id !== generation.current) { session.cancel(); return }
      setState('recording')
      const blob = await session.result
      if (id !== generation.current) return
      setAudio(blob); setState('ready'); recorder.current = null
    } catch (failure) {
      session.cancel()
      if (id !== generation.current) return
      recorder.current = null; setState('idle'); setError(recordingError(failure))
    }
  }
  const begin = () => { cancel(); setAudio(null); onStart() }
  return <div className="page-container py-8 sm:py-12">
    <Link href="/interview/start" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted"><ArrowLeft size={16} />返回准备</Link>
    <div className="mt-5 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
      <section className="rounded-3xl bg-ink p-6 text-white sm:p-10">
        <p className="text-sm text-white/70">候场室 · 下一位，就是你</p>
        <h1 className="mt-4 text-3xl font-bold sm:text-4xl">深呼吸，准备开口。</h1>
        <p className="mt-4 text-white/70">{position.positionName || '请先选择目标岗位'}</p>
        <div className="my-9 flex items-center justify-center gap-4" aria-hidden="true">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl border border-white/20"><Mic size={34} /></span>
          <span className="h-px flex-1 bg-white/20" />
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-lime text-ink"><MessageSquare size={40} /></span>
        </div>
        <ol aria-label="本场流程" className="grid grid-cols-3 gap-3 border-t border-white/20 pt-6 text-sm">
          {['介绍自己', '深入交流', '逐题复盘'].map((label, index) => <li key={label}><span className="mb-2 block text-white/50">0{index + 1}</span>{label}</li>)}
        </ol>
        <p className="mt-8 flex items-center gap-2 text-sm text-white/75"><FileText size={16} />{hasResume ? '结合你的经历提问' : '岗位通用练习 · 未提供简历'}</p>
      </section>
      <section className="space-y-6 py-2" aria-label="入场检查">
        <fieldset>
          <legend className="text-xl font-semibold text-ink">这场练到什么程度</legend>
          <p className="mt-2 text-sm text-muted">每种强度只消耗 1 次权益；时间或题数达到上限时结束，也可提前结束。</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {PRACTICE_OPTIONS.map(option => <button key={option.value} type="button" aria-pressed={practiceIntensity === option.value}
              onClick={() => useInterviewStore.setState({ practiceIntensity: option.value })}
              className={`min-h-24 rounded-xl border p-3 text-left ${practiceIntensity === option.value ? 'border-primary-500 bg-primary-50 text-primary-900' : 'border-line bg-white text-ink'}`}>
              <span className="block font-semibold">{option.label} · {option.durationMinutes} 分钟</span>
              <span className="mt-1 block text-xs text-muted">最多 {option.maxAnswers} 次作答</span>
              <span className="mt-1 block text-xs text-muted">{option.description}</span>
            </button>)}
          </div>
        </fieldset>
        <div><h2 className="text-xl font-semibold text-ink">用你舒服的方式开始</h2><p className="mt-2 text-sm text-muted">面试中可随时切换。试音仅在本机处理，不上传、不扣次。</p></div>
        <div className="grid grid-cols-2 gap-3" role="group" aria-label="入场回答方式">
          {([{ mode: 'voice', label: '语音面试', Icon: Mic }, { mode: 'text', label: '文字面试', Icon: MessageSquare }] as const).map(item => <button key={item.mode} aria-pressed={answerMode === item.mode} onClick={() => { cancel(); useInterviewStore.setState({ answerMode: item.mode }) }} className={`flex min-h-16 items-center justify-center gap-2 rounded-xl border p-3 ${answerMode === item.mode ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-line bg-white text-ink'}`}><item.Icon size={19} />{item.label}</button>)}
        </div>
        {answerMode === 'voice' && <div className="rounded-2xl border border-line bg-white p-5">
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled={state === 'requesting'} onClick={() => state === 'recording' ? recorder.current?.stop() : void testMic()} className="button-primary !min-h-11 !px-4 !text-sm">{state === 'requesting' ? '等待麦克风授权' : state === 'recording' ? '停止并回听' : '试一下麦克风'}</button>
            <button type="button" disabled={state === 'recording' || state === 'requesting' || !sound.isSupported} onClick={() => { sound.stop(); sound.handleStreamText('你好，欢迎来到面试麦。准备好了，我们就开始。', true) }} className="inline-flex min-h-11 items-center gap-2 text-sm text-ink disabled:opacity-50"><Volume2 size={17} />试听面试官</button>
          </div>
          {state === 'recording' && <div className="mt-4" role="status"><p className="mb-2 text-xs text-muted">说一句自我介绍，看看声音是否清晰</p><meter aria-label="麦克风音量" min={0} max={1} value={level} className="h-3 w-full" /></div>}
          {url && <div className="mt-4"><p className="mb-2 flex items-center gap-2 text-sm text-muted"><Check size={16} />录音已收到，请回听确认</p><audio controls src={url} aria-label="试音回放" className="w-full" /></div>}
          {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
          <p className="mt-3 text-xs text-muted">朗读由浏览器提供，正式回答采用分段录音、校对后发送。</p>
        </div>}
        <div className="rounded-xl bg-primary-50 p-4 text-sm text-primary-900">
          <p className="font-medium">正式开始消耗 1 次{type === 'special' ? '专业能力' : 'HR / 行为'}面试权益</p>
          <p className="mt-1">{remaining === undefined ? '余额以服务端确认为准' : `当前剩余 ${remaining} 次`} · 重试同一次开始不会重复扣次</p>
        </div>
        {remaining === 0 && <Link href="/profile?tab=redeem" className="block text-sm text-primary-700 underline">查看账户权益</Link>}
        <button onClick={begin} disabled={!position.positionName?.trim() || state === 'requesting' || state === 'recording' || remaining === 0} className="button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">正式开始面试<ArrowRight size={19} /></button>
      </section>
    </div>
  </div>
}
