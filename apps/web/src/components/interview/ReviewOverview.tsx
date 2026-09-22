'use client'

import { ArrowRight, Check, CheckCircle2, CircleDashed, FileText, Focus, Sparkles } from 'lucide-react'
import type { InterviewReview, ReviewStatus } from '@/api/interview-review'

const statusLabel: Record<ReviewStatus, string> = { not_ready: '进行中', pending: '待分析', generating: '分析中', completed: '已复盘', failed: '待重试', insufficient_data: '信息不足' }
export default function ReviewOverview({ review, selectedQuestion, onSelect }: { review: InterviewReview; selectedQuestion: number; onSelect: (question: number) => void }) {
  const answered = review.questions.filter(item => item.answer.trim()).length
  const dimensions = [...(review.report?.radarData || [])].sort((a, b) => b.score - a.score)
  return <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
    <section aria-labelledby="journey-title" className="overflow-hidden rounded-3xl bg-ink p-5 text-white sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="journey-title" className="flex items-center gap-2 text-base font-medium"><Focus className="h-5 w-5" aria-hidden="true" /> 本场路线</h2><span className="rounded-full border border-white/30 px-3 py-1 text-xs">{statusLabel[review.status]}</span></div>
      <div className="my-6 flex flex-wrap items-baseline gap-x-3 gap-y-1"><strong className="text-4xl tabular-nums">{answered}<span className="text-xl font-normal text-white/70"> / {review.questions.length}</span></strong><span className="text-sm text-white/80">道已回答</span></div>
      <ol aria-label="选择回看的题目" className="flex flex-wrap gap-3">
        {review.questions.map(item => <li key={item.questionNumber}><a href={`#answer-${item.questionNumber}`} onClick={() => onSelect(item.questionNumber)} aria-current={selectedQuestion === item.questionNumber ? 'step' : undefined} aria-label={`第 ${item.questionNumber} 题，${item.answer.trim() ? '已回答' : '未回答'}，点击回看`} className={`flex min-h-16 min-w-14 flex-col items-center justify-center gap-1 rounded-xl border px-3 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white ${selectedQuestion === item.questionNumber ? 'border-accent bg-accent text-ink' : 'border-white/30 hover:bg-white/10'}`}>
          <span className="flex items-center gap-1 text-base font-semibold">{item.answer.trim() ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" />}{String(item.questionNumber).padStart(2, '0')}</span><span className="text-xs">{item.answer.trim() ? '已答' : '未答'}</span>
        </a></li>)}
      </ol>
      {review.questions.length === 0 && <p className="text-sm text-white/80">还没有保存的回答</p>}
      <div aria-label="复盘流程" className="mt-7 flex items-center justify-between gap-1 border-t border-white/20 pt-5 text-xs sm:text-sm">
        <span className="flex items-center gap-1.5"><FileText className="h-4 w-4" aria-hidden="true" /> 原问答</span><ArrowRight className="h-4 w-4 text-white/60" aria-hidden="true" /><span className="flex items-center gap-1.5"><Sparkles className="h-4 w-4" aria-hidden="true" /> {review.report ? '分析完成' : statusLabel[review.status]}</span><ArrowRight className="h-4 w-4 text-white/60" aria-hidden="true" /><span className={`flex items-center gap-1.5 ${review.report ? '' : 'text-white/70'}`}><CheckCircle2 className="h-4 w-4" aria-hidden="true" /> 下一步</span>
      </div>
    </section>
    <section aria-labelledby="dimensions-title" className="rounded-3xl border border-line bg-white p-5 sm:p-7">
      <div className="flex items-center justify-between gap-3"><h2 id="dimensions-title" className="font-semibold">能力画像</h2><span className="text-xs text-muted">本场表现 · 0–100 分</span></div>
      {dimensions.length ? <ul className="mt-6 space-y-5">{dimensions.map(item => <li key={item.dimension}>
        <div className="mb-2 flex items-baseline justify-between gap-4 text-sm"><span>{item.dimension}</span><strong className="tabular-nums">{item.score}<span className="ml-1 font-normal text-muted">分</span></strong></div>
        <div role="meter" aria-label={item.dimension} aria-valuemin={0} aria-valuemax={100} aria-valuenow={item.score} aria-valuetext={`${item.score} 分，满分 100 分`} className="h-2.5 overflow-hidden rounded-full bg-primary-50"><div className="h-full rounded-full bg-primary-600" style={{ width: `${item.score}%` }} /></div>
      </li>)}</ul> : <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-muted"><CircleDashed className="h-10 w-10 stroke-1" aria-hidden="true" /><p className="text-sm">{review.status === 'insufficient_data' ? '信息不足，暂不评分' : review.report ? '本场暂无维度评分' : '分析完成后展示'}</p></div>}
      <p className="mt-6 text-xs text-muted">{review.report ? '只展示有分析结果的维度' : '问答已保存，可先逐题回看'}</p>
    </section>
  </div>
}
