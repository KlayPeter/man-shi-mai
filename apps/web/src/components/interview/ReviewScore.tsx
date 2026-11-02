'use client'

import { Target, Trophy } from 'lucide-react'
import type { InterviewReview } from '@/api/interview-review'

export default function ReviewScore({ review }: { review: InterviewReview }) {
  const report = review.report
  if (!report) return null
  const score = report.overallScore
  const scoring = report.scoring
  return <section aria-labelledby="review-score-title" className="overflow-hidden rounded-3xl border border-line bg-white">
    <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[auto_1fr] md:items-center">
      <div className="flex items-center gap-5">
        <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" className="stroke-primary-50" /><circle cx="60" cy="60" r="52" fill="none" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={`${score ?? 0} 100`} className="stroke-primary-600" /></svg>
          <div className="text-center"><strong className="text-4xl font-semibold tabular-nums">{score ?? '—'}</strong><p className="mt-1 text-xs text-muted">本场表现 / 100</p></div>
        </div>
        <div><h2 id="review-score-title" className="flex items-center gap-2 text-lg font-semibold">{score !== null && score >= 90 ? <Trophy className="h-5 w-5 text-primary-600" aria-hidden="true" /> : <Target className="h-5 w-5 text-primary-600" aria-hidden="true" />}{report.overallLevel || '本场表现'}</h2>
          <p className="mt-2 text-xs leading-5 text-muted">{scoring ? `${scoring.scoredQuestions} 道计分题 · ${scoring.answeredQuestions - scoring.scoredQuestions} 道非计分对话` : '基于本场回答的练习反馈'}</p>
        </div>
      </div>
      <div><p className="text-sm leading-7 text-ink">{report.summary}</p><div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">{['60 基本达标', '80 良好', '90 优秀'].map(label => <span key={label} className="rounded-full bg-paper px-3 py-1.5">{label}</span>)}</div></div>
    </div>
    <details className="border-t border-line px-5 sm:px-7"><summary className="flex min-h-12 cursor-pointer items-center text-sm font-medium text-primary-700">分数是怎么算的？</summary>
      {scoring ? <div className="space-y-4 pb-5 text-sm leading-6"><ol className="flex flex-wrap items-center gap-2 text-xs"><li className="rounded-lg bg-paper px-3 py-2">逐题对照原文</li><li aria-hidden="true">→</li><li className="rounded-lg bg-paper px-3 py-2">四维度加权</li><li aria-hidden="true">→</li><li className="rounded-lg bg-paper px-3 py-2">计分题平均</li></ol>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{scoring.weights.map(item => <div key={item.key} className="rounded-xl border border-line p-3"><p className="text-xs text-muted">{item.label}</p><strong className="mt-1 block text-lg tabular-nums">{item.weight}%</strong></div>)}</div>
        <p className="text-xs text-muted">每维度按 5 级证据标准对应 20 / 45 / 65 / 85 / 100 分。未展示的维度不按零分计算；反问和流程对话不计分。只有反问时暂不评分。优秀表示本场表现，不代表录取结果。</p>
      </div> : <p className="pb-5 text-sm text-muted">这是历史报告，未记录逐题评分明细；保留原有结果。</p>}
    </details>
  </section>
}
