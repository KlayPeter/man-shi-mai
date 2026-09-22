'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams, useRouter } from 'next/navigation'
import { useInterviewStore } from '@/stores/interviewStore'
import { toast } from '@/stores/toastStore'
import Icon from '@/components/ui/Icon'

const steps = [
  {
    id: 1,
    title: '选择岗位与简历',
    description: '锁定目标岗位，导入简历',
    path: '/interview/start'
  },
  {
    id: 2,
    title: '开始专项服务',
    description: '押题 · 模拟面试 · 行测+HR',
    path: '/interview'
  },
  {
    id: 3,
    title: '查看报告',
    description: '深度分析面试表现',
    path: '/interview/report'
  }
]

export default function InterviewLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const interviewStore = useInterviewStore()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const isHistory = searchParams.get('history') === 'true'
  const step = searchParams.get('step')
  const isProgressing = step === 'progress'
  const isInterviewing = step === 'interview' && interviewStore.interviewStatus !== 'ended'

  const currentStep = pathname === '/interview/start' ? 1
    : pathname === '/interview/report' ? 3
    : 2

  const serviceType = searchParams.get('serviceType') || 'resume'
  const serviceTitles: Record<string, string> = {
    resume: '面试押题',
    special: '专项面试模拟',
    behavior: '行测+HR面试'
  }

  const pageTitle = pathname === '/interview/start'
    ? '选择岗位与简历'
    : pathname === '/interview/report'
    ? '面试报告'
    : serviceTitles[serviceType] || '面试服务'

  const handleGoHome = () => {
    if (isProgressing) {
      toast({ title: '押题进行中，跳转会浪费一次机会哦～', color: 'yellow' })
      return
    }
    if (isInterviewing) {
      toast({ title: '请先结束面试再跳转', color: 'yellow' })
      return
    }
    router.push('/')
  }

  const handleGoStart = () => {
    if (isHistory) { router.push('/history'); return }
    if (isProgressing) {
      toast({ title: '押题进行中，跳转会浪费一次机会哦～', color: 'yellow' })
      return
    }
    if (isInterviewing) {
      toast({ title: '请先结束面试再跳转', color: 'yellow' })
      return
    }
    router.push('/interview/start')
  }

  const handleStepClick = (stepId: number) => {
    if (stepId === 1) { handleGoStart(); return }
    if (stepId > currentStep) return
    if (stepId === 3 && pathname !== '/interview/report') return
  }

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden font-sans">
      {/* Sidebar */}
      <div className="relative shrink-0">
        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute right-0 translate-x-[50%] top-[50%] -translate-y-[50%] z-30 w-10 h-10 rounded-lg bg-white border border-slate-200 shadow-md flex items-center justify-center hover:bg-slate-50 transition-all duration-300"
        >
          <Icon
            name={sidebarOpen ? 'i-heroicons-chevron-left' : 'i-heroicons-bars-3'}
            className="w-5 h-5 text-slate-600"
          />
        </button>

        <aside
          className={`h-full bg-white border-r border-slate-200 flex flex-col z-10 transition-[width] duration-300 ease-in-out overflow-hidden ${
            sidebarOpen ? 'w-64 lg:w-72' : 'w-0 border-r-0'
          }`}
        >
          <div className="w-64 lg:w-72 h-full flex flex-col">
            {/* Header */}
            <div className="py-6 px-4 pb-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-200">
                  <Icon name="i-heroicons-academic-cap" className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="font-bold text-slate-900 text-base leading-tight mb-0.5">面试麦：全链路 AI 服务</h1>
                  <p className="text-xs text-slate-500">押题·模拟·行测 三位一体</p>
                </div>
              </div>
              <div className="px-1">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">极简三步，快速开始</h2>
              </div>
            </div>

            {/* Steps */}
            <nav className="flex-1 overflow-y-auto px-4 pt-1 space-y-1">
              {steps.map((s, index) => {
                const isActive = s.id === currentStep
                const isDone = s.id < currentStep
                const isLocked = s.id > currentStep
                return (
                  <div key={s.id} className="relative pb-8 last:pb-0">
                    {index !== steps.length - 1 && (
                      <div className={`absolute top-8 left-4 bottom-0 w-px -ml-0.5 ${isDone ? 'bg-primary-100' : 'bg-slate-100'}`} />
                    )}
                    <div
                      className={`group w-full text-left relative z-10 flex gap-4 transition-opacity ${
                        isLocked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:opacity-80'
                      }`}
                      onClick={() => handleStepClick(s.id)}
                    >
                      <div className={`shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300 bg-white ${
                        isActive ? 'border-primary-600 text-primary-600 shadow-md scale-110'
                          : isDone ? 'border-primary-200 bg-primary-50 text-primary-600'
                          : 'border-slate-200 text-slate-300'
                      }`}>
                        {isDone
                          ? <Icon name="i-heroicons-check" className="w-4 h-4" />
                          : isLocked
                          ? <Icon name="i-heroicons-lock-closed" className="w-3.5 h-3.5" />
                          : <span>{s.id}</span>
                        }
                      </div>
                      <div className="pt-1">
                        <h3 className={`text-sm font-semibold transition-colors duration-200 ${
                          isActive ? 'text-slate-900' : isDone ? 'text-slate-700' : 'text-slate-400'
                        }`}>{s.title}</h3>
                        <p className={`text-xs mt-1 transition-colors duration-200 pr-2 ${
                          isActive ? 'text-slate-500' : 'text-slate-400'
                        }`}>{s.description}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </nav>

            {/* User info at bottom */}
            <div className="p-4 border-t border-slate-100">
              <Link href="/profile" className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-700 transition-colors">
                <Icon name="i-heroicons-user-circle" className="w-4 h-4" />
                个人中心
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Main */}
      <main className="flex-1 min-w-0 bg-slate-50 flex flex-col h-full relative">
        {/* Top header */}
        <header className="h-16 px-6 border-b border-slate-200/60 bg-white/50 backdrop-blur-sm flex items-center justify-between shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <button onClick={handleGoHome} className="hover:text-primary-600 transition-colors flex items-center gap-1">
              <Icon name="i-heroicons-home" className="w-4 h-4" />
              首页
            </button>
            <span className="text-slate-300">/</span>
            <button onClick={handleGoStart} className="hover:text-primary-600 transition-colors flex items-center gap-1">
              {isHistory ? '查看服务记录' : '开始专项服务'}
            </button>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-medium">{pageTitle}</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-xs text-slate-400 flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              AI 服务在线
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto relative w-full flex flex-col">
          <div className="flex-1 overflow-hidden px-4 py-2 lg:px-8 lg:py-2">
            <div className="max-w-[1600px] mx-auto h-full w-full">
              {children}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
