'use client'

import React from 'react'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Check, FileText, MessageSquare, ChartNoAxesCombined, Lightbulb, UserRound } from 'lucide-react'
import { useInterviewStore } from '@/stores/interviewStore'
import { toast } from '@/stores/toastStore'
import Brand from '@/components/Brand'

const steps = [
  { id: 1, title: '准备面试', description: '选择岗位，带上你的简历', icon: FileText },
  { id: 2, title: '进入练习', description: '练习回答，把经历讲清楚', icon: MessageSquare },
  { id: 3, title: '复盘与提升', description: '查看反馈，找到下一步', icon: ChartNoAxesCombined },
]

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const interviewStatus = useInterviewStore(s => s.interviewStatus)
  const isHistory = searchParams.get('history') === 'true'
  const step = searchParams.get('step')
  const currentStep = pathname === '/interview/start' ? 1 : pathname === '/interview/report' || step === 'complete' ? 3 : 2
  const isBusy = step === 'progress' || (step === 'interview' && ['in_progress', 'starting'].includes(interviewStatus))
  const navigate = (path: string) => {
    if (isBusy) { toast({ title: step === 'progress' ? '正在生成内容，请完成后再离开' : '请先结束面试再离开练习室', color: 'yellow' }); return }
    router.push(path)
  }
  const title = currentStep === 1 ? '面试准备' : currentStep === 3 ? '练习报告' : isHistory ? '练习回顾' : '面试练习室'
  return (
    <div className="interview-shell">
      <aside className="interview-sidebar">
        <button onClick={() => navigate('/')} aria-label="返回面试麦首页" className="mx-6 mb-12 mt-7 w-fit"><Brand light /></button>
        <p className="mb-4 px-7 text-xs tracking-widest text-white/60">你的练习旅程</p>
        <nav aria-label="面试流程" className="space-y-3 px-4">
          {steps.map(item => <div key={item.id} className="interview-sidebar-step" aria-current={item.id === currentStep ? 'step' : undefined}>
            <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.id === currentStep ? 'bg-lime text-ink' : 'bg-white/5 text-white/60'}`}>{item.id < currentStep ? <Check size={17} aria-hidden="true" /> : <item.icon size={17} aria-hidden="true" />}</span>
            <div>{item.id === 1 && currentStep > 1 ? <button onClick={() => navigate(isHistory ? '/history' : '/interview/start')} className="min-h-6 text-left text-sm font-medium text-white/80 hover:text-white">{isHistory ? '返回练习记录' : item.title}</button> : <p className={`text-sm font-medium ${currentStep === item.id ? 'text-white' : 'text-white/65'}`}>{item.title}</p>}<p className="mt-2 text-xs leading-5 text-white/55">{item.description}</p></div>
          </div>)}
        </nav>
        <div className="mx-5 mb-6 mt-auto rounded-xl border border-white/10 bg-white/5 p-4"><Lightbulb size={19} className="mb-3 text-lime" aria-hidden="true" /><p className="text-sm font-medium text-white/90">这里允许你慢慢来。</p><p className="mt-2 text-xs leading-6 text-white/60">想清楚再回答。每一次练习，都是为了真实面试时更从容。</p></div>
        <button onClick={() => navigate('/profile')} className="mx-5 mb-5 flex min-h-11 items-center gap-2 border-t border-white/10 pt-4 text-xs text-white/70"><UserRound size={16} aria-hidden="true" />我的账户<ArrowUpRight size={14} className="ml-auto" aria-hidden="true" /></button>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-[76px] shrink-0 items-center justify-between gap-3 border-b border-line bg-paper px-4 sm:px-7">
          <div className="flex items-center gap-3"><button onClick={() => navigate('/')} aria-label="返回首页" className="icon-button"><ArrowLeft size={18} /></button><span className="text-sm font-semibold text-ink">{title}</span><span className="hidden text-xs text-muted sm:block">/ 为下一次机会做准备</span></div>
          <span className="rounded-full border border-line bg-white px-3 py-1.5 text-xs text-muted">第 {currentStep} / 3 步</span>
        </header>
        <div className="interview-scroll"><div>{children}</div></div>
      </main>
    </div>
  )
}
