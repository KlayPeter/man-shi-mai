'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isAxiosError } from 'axios'
import { getInterviewReview, generateInterviewReview, type InterviewReview as Review, type ReviewEvidence } from '@/api/interview-review'
import { ArrowDown, ArrowRight, ChevronDown, Lightbulb, Quote, TrendingUp } from 'lucide-react'
import ReviewOverview from './ReviewOverview'

const buttonStyle = 'inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 disabled:opacity-50'

function EvidenceCard({ item, onSelect }: { item: ReviewEvidence; onSelect: (number: number) => void }) {
  const positive = item.kind === 'strength'
  return <div className="rounded-2xl border border-line bg-white p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${positive ? 'bg-primary-100 text-primary-700' : 'bg-paper text-ink'}`}>{positive ? <TrendingUp className="h-5 w-5" aria-hidden="true" /> : <Lightbulb className="h-5 w-5" aria-hidden="true" />}</span><span className="text-xs text-muted">第 {item.questionNumber} 题</span></div>
    <p className="text-xs font-medium text-primary-600">{positive ? '保留这个亮点' : '下次练这个'}</p>
    <p className="mt-2 text-base font-medium leading-7">{item.feedback}</p>
    <ArrowDown className="my-3 h-4 w-4 text-primary-600" aria-hidden="true" />
    <p className="rounded-xl bg-paper p-3 text-sm leading-6">{item.practice}</p>
    <details className="mt-3 text-sm"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-muted"><Quote className="h-4 w-4" aria-hidden="true" /> 查看回答依据<ChevronDown className="ml-auto h-4 w-4" aria-hidden="true" /></summary><blockquote className="border-l-2 border-primary-300 pl-3 leading-6 text-muted">“{item.quote}”</blockquote></details>
    <a href={`#answer-${item.questionNumber}`} onClick={() => onSelect(item.questionNumber)} className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-primary-600 underline underline-offset-4">回看完整回答<ArrowRight className="h-4 w-4" aria-hidden="true" /></a>
  </div>
}

export default function InterviewReview({ resultId }: { resultId: string }) {
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [revision, setRevision] = useState(0)
  const [selectedQuestion, setSelectedQuestion] = useState(1)
  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let polls = 0
    setReview(previous => previous?.resultId === resultId ? previous : null)
    setLoading(true)
    setError('')
    const load = async () => {
      try {
        const result = await getInterviewReview(resultId, controller.signal)
        if (controller.signal.aborted) return
        setReview(result)
        setLoading(false)
        if (result.status === 'generating') {
          if (++polls < 40) timer = setTimeout(load, 3000)
          else setError('生成耗时较长，已停止自动刷新。原问答可继续查看，稍后可手动刷新。')
        }
      } catch (cause: unknown) {
        if (controller.signal.aborted) return
        setLoading(false)
        setError(isAxiosError(cause) && cause.response?.status === 404 ? '没有找到这场面试，或当前账户无权查看。' : '暂时无法读取复盘，请重试。已保存的问答不会被清除。')
      }
    }
    void load()
    return () => { controller.abort(); if (timer) clearTimeout(timer) }
  }, [resultId, revision])

  const generate = async () => {
    if (generating) return
    setGenerating(true)
    setError('')
    try {
      await generateInterviewReview(resultId)
      setRevision(value => value + 1)
    } catch {
      setError('暂时无法发起分析。可以刷新状态；同一场正在生成的报告不会重复启动。')
    } finally { setGenerating(false) }
  }
  const report = review?.report
  const highlights = report?.evidence.filter(item => item.kind === 'strength').slice(0, 1) || []
  const improvements = report?.evidence.filter(item => item.kind === 'improvement').slice(0, 2) || []

  return <div className="mx-auto max-w-5xl space-y-7 px-2 py-8 text-ink [overflow-wrap:anywhere] sm:px-5">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="mb-3 text-xs font-semibold tracking-widest text-primary-600">练过 · 看懂 · 再进步</p><h1 className="text-3xl font-semibold">本场练习复盘</h1><p className="mt-3 text-sm text-muted">{review?.position || '面试复盘'}{review?.company ? ` · ${review.company}` : ''}</p></div>
      <div className="flex flex-wrap gap-3"><Link href="/history" className={buttonStyle}>练习记录</Link><Link href="/interview/start" className={`${buttonStyle} bg-primary-600 text-white`}>再练一场</Link></div>
    </header>
    {loading && <p role="status" className="rounded-2xl bg-white p-6">正在读取复盘与原问答…</p>}
    {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><p>{error}</p><button type="button" onClick={() => setRevision(value => value + 1)} className={`${buttonStyle} mt-4`}>重新读取</button></div>}
    {review && !report && <section className="rounded-2xl border border-line bg-white p-6" aria-label="报告状态">
      <h2 className="text-lg font-semibold">{({ not_ready: '本场面试尚未结束', pending: '原问答已保存，准备开始复盘', generating: '正在分析本场回答', completed: '复盘已完成', failed: '报告尚未生成成功', insufficient_data: '信息不足，暂不评分' })[review.status]}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">{review.message || (review.status === 'generating' ? '可以先回看下面的问答。生成完成后，分析会自动显示。' : '分析将关联具体回答，帮助你找到下一次练习的重点。')}</p>
      {review.canGenerate && <button type="button" onClick={generate} disabled={generating} className={`${buttonStyle} mt-5 bg-primary-600 text-white`}>{generating ? '正在发起…' : review.status === 'failed' ? '重新生成复盘' : '生成本场复盘'}</button>}
      {review.status === 'not_ready' && <Link href={`/interview?serviceType=${review.type}&history=true&resultId=${encodeURIComponent(resultId)}`} className={`${buttonStyle} mt-5`}>返回这场面试</Link>}
    </section>}
    {review && <ReviewOverview review={review} selectedQuestion={selectedQuestion} onSelect={setSelectedQuestion} />}
    {report && <>
      <section aria-labelledby="review-focus"><h2 id="review-focus" className="mb-4 text-xl font-semibold">你的下一步</h2>
        {highlights.length + improvements.length > 0 ? <div className={`grid gap-4 ${highlights.length + improvements.length === 3 ? 'lg:grid-cols-3' : 'md:grid-cols-2'}`}>{[...highlights, ...improvements].map((item, index) => <EvidenceCard key={index} item={item} onSelect={setSelectedQuestion} />)}</div> : <p className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">暂无逐题依据，先回看原问答。</p>}
      </section>
      <details className="rounded-2xl border border-line bg-white p-6"><summary className="cursor-pointer font-semibold">完整分析 · {report.overallScore === null ? '信息不足，暂不评分' : `${report.overallScore} 分 · ${report.overallLevel}`}</summary>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-7">{report.summary}</p>
        <p className="mt-3 text-xs text-muted">这是本次练习表现的 AI 反馈，不代表录取结果。{report.rubricVersion ? `评价标准：${report.rubricVersion}` : '历史报告未记录评价标准版本。'}</p>
        {report.radarData.length > 0 && <ul className="mt-5 space-y-2 text-sm">{report.radarData.map(item => <li key={item.dimension}><strong>{item.dimension}：</strong>{item.description || '暂无维度说明'}</li>)}</ul>}
        {report.improvements.length > 0 && <ul className="mt-4 space-y-3 text-sm leading-6">{report.improvements.map((item, index) => <li key={index}><strong>{item.category}：</strong>{item.suggestion}</li>)}</ul>}
      </details>
    </>}
    {review && <section aria-labelledby="review-answers"><div className="mb-4 flex items-baseline gap-3"><h2 id="review-answers" className="text-xl font-semibold">逐题回看</h2><span className="text-sm text-muted">{review.questions.filter(item => item.answer.trim()).length} 道已回答</span></div>
      <div className="space-y-3">{review.questions.map(item => <article id={`answer-${item.questionNumber}`} key={item.questionNumber} className="scroll-mt-24 rounded-2xl border border-line bg-white">
        <details open={selectedQuestion === item.questionNumber}>
          <summary onClick={event => { event.preventDefault(); setSelectedQuestion(selectedQuestion === item.questionNumber ? 0 : item.questionNumber) }} className="flex min-h-16 cursor-pointer list-none items-center gap-3 p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary-600">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-50 text-sm font-semibold text-primary-700">{String(item.questionNumber).padStart(2, '0')}</span><h3 className="min-w-0 flex-1 text-base font-medium leading-7 [overflow-wrap:anywhere]">{item.question || '问题未保存完整'}</h3><ChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${selectedQuestion === item.questionNumber ? 'rotate-180' : ''}`} aria-hidden="true" />
          </summary>
          <div className="space-y-4 px-5 pb-5 sm:px-7 sm:pb-7"><div><p className="mb-2 text-xs font-medium text-muted">你的回答</p><p className="whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm leading-7 [overflow-wrap:anywhere]">{item.answer || '尚未回答'}</p></div>
            {item.comment ? <div className="border-l-2 border-primary-300 pl-4 text-sm leading-7"><p className="text-xs font-medium text-primary-600">单题评价{item.score !== null ? ` · ${item.score} 分` : ''}</p><p className="whitespace-pre-wrap">{item.comment}</p></div> : <p className="text-xs text-muted">暂无单题评价</p>}
            {report?.evidence.filter(evidence => evidence.questionNumber === item.questionNumber).map((evidence, index) => <div key={index} className="flex flex-col gap-3 rounded-xl bg-primary-50 p-4 text-sm leading-6 sm:flex-row sm:items-start"><p className="flex-1">{evidence.feedback}</p><ArrowRight className="hidden h-4 w-4 shrink-0 text-primary-600 sm:mt-1 sm:block" aria-hidden="true" /><p className="flex-1 font-medium">{evidence.practice}</p></div>)}
          </div>
        </details>
      </article>)}</div>
      {review.questions.length === 0 && <p className="rounded-2xl border border-line bg-white p-6 text-sm text-muted">本场没有保存的问答记录。</p>}
    </section>}
  </div>
}
