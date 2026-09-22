'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import RadarChart from '@/components/interview/RadarChart'
import { toast } from '@/stores/toastStore'
import { useInterviewStore } from '@/stores/interviewStore'
import request from '@/lib/request'
import { marked } from 'marked'

interface SkillItem {
  skill: string
  proficiency: string
}

interface LearningPriority {
  topic: string
  reason: string
  priority: 'high' | 'medium' | 'low'
}

interface ReportData {
  resultId: string
  type: string
  company: string
  position: string
  salaryRange: string
  createdAt: string
  matchScore: number
  matchLevel: string
  matchedSkills: SkillItem[]
  missingSkills: string[]
  knowledgeGaps: string[]
  learningPriorities: LearningPriority[]
  radarData: { label: string; value: number }[]
  strengths: string[]
  weaknesses: string[]
  summary: string
  interviewTips: string[]
  totalQuestions: number
  questionDistribution: Record<string, number>
  viewCount: number
}

const defaultReport: ReportData = {
  resultId: '',
  type: '',
  company: '加载中...',
  position: '加载中...',
  salaryRange: '',
  createdAt: '',
  matchScore: 0,
  matchLevel: '-',
  matchedSkills: [],
  missingSkills: [],
  knowledgeGaps: [],
  learningPriorities: [],
  radarData: [],
  strengths: [],
  weaknesses: [],
  summary: '正在加载评估报告...',
  interviewTips: [],
  totalQuestions: 0,
  questionDistribution: {},
  viewCount: 0
}

export default function ReportPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const interviewStore = useInterviewStore()
  const resultId = searchParams.get('resultId')
  const serviceType = searchParams.get('serviceType') || 'resume'

  const [reportData, setReportData] = useState<ReportData>(defaultReport)
  const [loading, setLoading] = useState(true)
  const [showTrainingModal, setShowTrainingModal] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!resultId) {
      toast({ title: '缺少报告 ID，即将返回', color: 'red' })
      router.replace('/interview/start')
      return
    }
    fetchReport()
  }, [resultId])

  const fetchReport = async () => {
    try {
      setLoading(true)
      const res = await request.get(`/interview/analysis/report/${resultId}`)
      setReportData(res as unknown as ReportData)
      setIsGenerating(false)
      setLoading(false)
    } catch (err: any) {
      // 检查多种可能的错误消息位置
      const errorMsg = err?.response?.data?.message || err?.message || err?.toString() || ''
      const isReportGenerating = errorMsg.includes('生成') || errorMsg.includes('报告') || errorMsg.includes('GENERATING')

      if (isReportGenerating) {
        setIsGenerating(true)
        // 显示友好的提示信息
        toast({
          title: '评估报告生成中',
          description: errorMsg || '报告正在生成，预计1-2分钟，系统将自动刷新',
          color: 'blue'
        })
        setTimeout(() => fetchReport(), 5000)
      } else {
        setLoading(false)
        toast({ title: '获取报告失败', description: errorMsg || '请稍后重试', color: 'red' })
      }
    }
  }

  const handleRestart = () => {
    interviewStore.reset()
    router.push('/interview/start')
  }

  const handleBackHome = () => {
    router.push('/')
  }

  const handleBackToQuestion = () => {
    router.back()
  }

  const showTrainingButton = (() => {
    const keywords = ['前端', 'web', '开发']
    const position = reportData.position?.toLowerCase() || ''
    const isRelated = keywords.some(k => position.includes(k))
    const score = Number(reportData.matchScore) || 0
    return isRelated && score < 70
  })()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Icon name="i-heroicons-arrow-path" className="w-10 h-10 text-primary-500 animate-spin" />
          <p className="text-slate-500 text-sm">
            {isGenerating ? '评估报告正在生成中，预计1-2分钟...' : '正在加载评估报告...'}
          </p>
          {isGenerating && (
            <p className="text-xs text-slate-400">系统会自动刷新，请稍候</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col gap-6 py-6 px-2">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 text-green-700 rounded-full mb-3">
            <Icon name="i-heroicons-check-circle" className="w-5 h-5" />
            <span className="font-medium">评估已完成</span>
          </div>
          <h1 className="text-3xl font-bold text-neutral-900">面试评估报告</h1>
          <p className="text-neutral-600 mt-2 text-sm">
            针对 <span className="font-semibold text-primary-600">{reportData.company} - {reportData.position}</span> 岗位的详细评估
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-3">
          <button
            onClick={handleBackHome}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            <Icon name="i-heroicons-home" className="w-4 h-4" />
            返回首页
          </button>
          <button
            onClick={handleBackToQuestion}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-primary-200 text-primary-600 hover:bg-primary-50 text-sm font-medium transition-colors"
          >
            <Icon name="i-heroicons-arrow-left" className="w-4 h-4" />
            上一步，查看详情问题
          </button>
          <button
            onClick={handleRestart}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 text-sm font-medium transition-colors"
          >
            <Icon name="i-heroicons-arrow-path" className="w-4 h-4" />
            趁热打铁，再来一次～
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full overflow-y-auto pr-1 space-y-6 pb-10">

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-gradient-to-br from-primary-50 to-white rounded-xl border border-primary-100 p-8 flex flex-col justify-center relative overflow-hidden">
              <div className="relative z-10">
                <h2 className="text-lg font-semibold text-neutral-900 mb-6">岗位匹配度</h2>
                <div className="flex items-baseline gap-4 mb-4">
                  <span className="text-6xl font-bold text-primary-600 tracking-tight">{reportData.matchScore}</span>
                  <span className="text-xl text-neutral-600 font-medium">分</span>
                  <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm font-bold">{reportData.matchLevel}</span>
                </div>
                <div
                  className="text-neutral-600 leading-relaxed mb-6 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: marked.parse(reportData.summary || '') as string }}
                />

                {showTrainingButton && (
                  <div className="mb-6">
                    <button
                      onClick={() => setShowTrainingModal(true)}
                      className="w-full py-3 rounded-xl bg-primary-50 text-primary-700 font-bold text-sm flex items-center justify-center gap-2 animate-pulse hover:animate-none hover:bg-primary-100 transition-colors"
                    >
                      <Icon name="i-heroicons-sparkles" className="w-5 h-5" />
                      匹配度较低？获取 1v1 私教特训方案
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: '匹配技能', value: reportData.matchedSkills?.length || 0 },
                    { label: '缺失技能', value: reportData.missingSkills?.length || 0 },
                    { label: '知识缺口', value: reportData.knowledgeGaps?.length || 0 },
                  ].map(item => (
                    <div key={item.label} className="bg-white/60 rounded-lg p-3 border border-primary-100">
                      <div className="text-2xl font-bold text-neutral-900">{item.value}</div>
                      <div className="text-xs text-neutral-500 mt-1">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-primary-100/50 rounded-full blur-3xl" />
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4">能力维度分析</h2>
              <div className="flex-1 flex items-center justify-center min-h-[300px]">
                <RadarChart data={reportData.radarData || []} />
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Icon name="i-heroicons-check-badge" className="w-5 h-5 text-green-500" />
                已具备技能
              </h2>
              {(reportData.matchedSkills?.length || 0) > 0 ? (
                <div className="space-y-3">
                  {(reportData.matchedSkills || []).map((skill, i) => (
                    <div key={i} className="p-3 bg-green-50/50 rounded-lg border border-green-100">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-green-800">{skill.skill}</span>
                        <Icon name="i-heroicons-check-circle" className="w-4 h-4 text-green-600" />
                      </div>
                      <p className="text-xs text-green-700/80">{skill.proficiency}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-400">暂无匹配技能数据</p>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Icon name="i-heroicons-exclamation-triangle" className="w-5 h-5 text-amber-500" />
                需补充技能 & 知识
              </h2>
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">缺失技能</h3>
                  {(reportData.missingSkills?.length || 0) > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {(reportData.missingSkills || []).map((skill, i) => (
                        <span key={i} className="px-2.5 py-1 bg-red-50 text-red-700 text-xs rounded-md border border-red-100 font-medium">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-400">暂无缺失技能</p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-neutral-700 mb-2">知识缺口</h3>
                  {(reportData.knowledgeGaps?.length || 0) > 0 ? (
                    <ul className="space-y-2">
                      {(reportData.knowledgeGaps || []).map((gap, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-neutral-600">
                          <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                          <span>{gap}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-neutral-400">暂无知识缺口</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {(reportData.learningPriorities?.length || 0) > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-neutral-900 mb-6 flex items-center gap-2">
                <Icon name="i-heroicons-academic-cap" className="w-5 h-5 text-primary-600" />
                建议学习路径
              </h2>
              <div className="space-y-4">
                {(reportData.learningPriorities || []).map((item, i) => (
                  <div
                    key={i}
                    className={`flex flex-col sm:flex-row gap-4 p-4 rounded-xl border transition-all hover:shadow-md ${
                      item.priority === 'high' ? 'bg-red-50/30 border-red-100' : 'bg-blue-50/30 border-blue-100'
                    }`}
                  >
                    <div className="shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wide ${
                        item.priority === 'high' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {item.priority === 'high' ? '高优先级' : '中优先级'}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-neutral-900 mb-1">{item.topic}</h3>
                      <p className="text-sm text-neutral-600">{item.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(reportData.interviewTips?.length || 0) > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Icon name="i-heroicons-chat-bubble-bottom-center-text" className="w-5 h-5 text-purple-600" />
                面试准备建议
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {(reportData.interviewTips || []).map((tip, i) => (
                  <div key={i} className="flex gap-3 p-3 bg-purple-50/50 rounded-lg border border-purple-100">
                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0 text-xs font-bold">
                      {i + 1}
                    </div>
                    <p className="text-sm text-neutral-700 pt-0.5">{tip}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showTrainingModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">1v1 私教训练营</h3>
              <button onClick={() => setShowTrainingModal(false)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <Icon name="i-heroicons-x-mark" className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="px-6 py-6 text-center space-y-6">
              <p className="text-neutral-600 text-sm">
                针对您的薄弱环节，提供定制化的一对一辅导，助您快速补齐短板，拿下心仪 Offer！
              </p>
              <div className="flex justify-center">
                <div className="w-48 h-48 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center">
                  <Icon name="i-heroicons-qr-code" className="w-24 h-24 text-gray-400" />
                </div>
              </div>
              <p className="text-xs text-neutral-500">扫码添加微信（备注：<span className="font-bold text-neutral-800">训练营</span>）</p>
              <a
                href="https://mp.weixin.qq.com/s/q4oxZlVKfz96XqmK2l56iQ"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full py-3 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors text-center"
              >
                查看训练营详情
                <Icon name="i-heroicons-arrow-top-right-on-square" className="w-4 h-4 inline ml-1" />
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
