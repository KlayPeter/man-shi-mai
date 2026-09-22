'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { isAxiosError } from 'axios'
import { getInterviewReview, generateInterviewReview, type InterviewReview as Review, type ReviewEvidence } from '@/api/interview-review'
import RadarChart from './RadarChart'

const buttonStyle = 'inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 py-2 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600 disabled:opacity-50'

function EvidenceCard({ item }: { item: ReviewEvidence }) {
  return <div className="rounded-2xl border border-line bg-white p-5">
    <p className="mb-3 text-xs font-semibold tracking-wider text-primary-600">{item.kind === 'strength' ? '值得保留' : '下次改进'} · 第 {item.questionNumber} 题</p>
    <p className="font-medium leading-7">{item.feedback}</p>
    <blockquote className="my-4 border-l-2 border-primary-300 pl-4 text-sm leading-6 text-muted">“{item.quote}”</blockquote>
    <p className="text-sm leading-6"><span className="font-medium">下次这样练：</span>{item.practice}</p>
    <a href={`#answer-${item.questionNumber}`} className="mt-3 inline-flex min-h-11 items-center text-sm text-primary-600 underline underline-offset-4">回看这道题的完整回答</a>
  </div>
}

export default function InterviewReview({ resultId }: { resultId: string }) {
  const [review, setReview] = useState<Review | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [revision, setRevision] = useState(0)
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

  return <div className="mx-auto max-w-5xl space-y-7 px-2 py-8 text-ink sm:px-5">
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div><p className="mb-3 text-xs font-semibold tracking-widest text-primary-600">每一次回答，都能成为下一次的底气</p><h1 className="text-3xl font-semibold">把这一场，变成下一场的进步。</h1><p className="mt-3 text-sm text-muted">{review?.position || '面试复盘'}{review?.company ? ` · ${review.company}` : ''}</p></div>
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
    {report && <>
      <section aria-labelledby="review-focus"><h2 id="review-focus" className="mb-4 text-xl font-semibold">这次先带走什么</h2>
        {highlights.length + improvements.length > 0 ? <div className="grid gap-4 md:grid-cols-3">{[...highlights, ...improvements].map((item, index) => <EvidenceCard key={index} item={item} />)}</div> : <p className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">这份历史报告尚无逐题引用，不补造分析依据。可以在下方查看已保存的问答和评价。</p>}
      </section>
      <details className="rounded-2xl border border-line bg-white p-6"><summary className="cursor-pointer font-semibold">完整分析 · {report.overallScore === null ? '信息不足，暂不评分' : `${report.overallScore} 分 · ${report.overallLevel}`}</summary>
        <p className="mt-5 whitespace-pre-wrap text-sm leading-7">{report.summary}</p>
        <p className="mt-3 text-xs text-muted">这是本次练习表现的 AI 反馈，不代表录取结果。{report.rubricVersion ? `评价标准：${report.rubricVersion}` : '历史报告未记录评价标准版本。'}</p>
        {report.radarData.length > 0 && <div className="mt-5 flex flex-wrap items-center gap-6">{report.radarData.length >= 3 && <RadarChart data={report.radarData} />}<ul className="space-y-2 text-sm">{report.radarData.map(item => <li key={item.dimension}>{item.dimension}：{item.score} · {item.description}</li>)}</ul></div>}
        {report.improvements.length > 0 && <ul className="mt-4 space-y-3 text-sm leading-6">{report.improvements.map((item, index) => <li key={index}><strong>{item.category}：</strong>{item.suggestion}</li>)}</ul>}
      </details>
    </>}
    {review && <section aria-labelledby="review-answers"><div className="mb-4 flex items-baseline gap-3"><h2 id="review-answers" className="text-xl font-semibold">逐题回看</h2><span className="text-sm text-muted">{review.questions.filter(item => item.answer.trim()).length} 道已回答</span></div>
      <div className="space-y-4">{review.questions.map(item => <article id={`answer-${item.questionNumber}`} key={item.questionNumber} className="scroll-mt-24 rounded-2xl border border-line bg-white p-5 sm:p-7">
        <p className="mb-3 text-xs font-semibold text-primary-600">第 {item.questionNumber} 题</p><h3 className="whitespace-pre-wrap text-lg font-medium leading-7">{item.question || '问题内容未保存完整'}</h3>
        <p className="mb-2 mt-5 text-xs font-medium text-muted">你的回答</p><p className="whitespace-pre-wrap rounded-xl bg-paper p-4 text-sm leading-7">{item.answer || '这道题尚未回答。'}</p>
        {item.comment ? <div className="mt-4 text-sm leading-7"><p className="font-medium">已有单题评价{item.score !== null ? ` · ${item.score} 分` : ''}</p><p className="whitespace-pre-wrap">{item.comment}</p></div> : <p className="mt-4 text-xs text-muted">暂无单题评价。</p>}
        {report?.evidence.filter(evidence => evidence.questionNumber === item.questionNumber).map((evidence, index) => <div key={index} className="mt-5"><EvidenceCard item={evidence} /></div>)}
      </article>)}</div>
      {review.questions.length === 0 && <p className="rounded-2xl border border-line bg-white p-6 text-sm text-muted">本场没有保存的问答记录。</p>}
    </section>}
  </div>
}
