'use client'

import React, { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { useUserStore } from '@/stores/userStore'
import request from '@/lib/request'

const tabs = [
  { key: 'resume', label: '面试押题', icon: 'i-heroicons-document-text' },
  { key: 'special', label: '专项面试', icon: 'i-heroicons-light-bulb' },
  { key: 'behavior', label: '行测 + HR', icon: 'i-heroicons-users' }
]

const API_MAP: Record<string, string> = {
  resume: '/interview/resume/quiz/history',
  special: '/interview/special/history',
  behavior: '/interview/behavior/history'
}

function formatDate(date: string) {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })
}

export default function HistoryPage() {
  const router = useRouter()
  const userStore = useUserStore()
  const [activeTab, setActiveTab] = useState('resume')
  const [isLoading, setIsLoading] = useState(false)
  const [list, setList] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const limit = 10

  const currentTabLabel = tabs.find(t => t.key === activeTab)?.label || ''

  const loadData = useCallback(async (tab = activeTab, currentPage = page) => {
    setIsLoading(true)
    try {
      const data: any = await request.get(`${API_MAP[tab]}?page=${currentPage}&limit=${limit}`)
      const records = Array.isArray(data) ? data : (data?.list || data?.records || [])
      setList(records)
      setTotal(Array.isArray(data) ? data.length : (data?.total || records.length))
    } catch {
      setList([])
      setTotal(0)
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, page])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(activeTab, page) }, [activeTab, page])

  const handleTabChange = (key: string) => {
    if (activeTab === key) return
    setActiveTab(key)
    setPage(1)
    setList([])
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
  }

  const handleView = (record: any) => {
    if (record.resultId) {
      router.push(`/interview?serviceType=${activeTab}&history=true&resultId=${record.resultId}`)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 py-8">
      <div className="container px-4 mx-auto max-w-6xl">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">服务记录</h1>
          <p className="text-gray-500 text-sm mt-1">查看您的历史面试押题与评估记录</p>
        </div>

        <div className="flex flex-col md:flex-row gap-6 items-start">
          <div className="w-full md:w-64 shrink-0 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-2">
              <div className="space-y-1">
                {tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => handleTabChange(tab.key)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.key
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                      activeTab === tab.key ? 'bg-white text-primary-600 shadow-sm' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Icon name={tab.icon} className="w-5 h-5" />
                    </div>
                    <span>{tab.label}</span>
                    {activeTab === tab.key && (
                      <Icon name="i-heroicons-chevron-right" className="w-4 h-4 ml-auto text-primary-400" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl p-4 text-white shadow-lg shadow-primary-500/20 hidden md:block">
              <div className="flex items-center gap-2 mb-2 opacity-90">
                <Icon name="i-heroicons-sparkles" className="w-4 h-4" />
                <span className="text-xs font-medium">AI 面试助手</span>
              </div>
              <p className="text-sm opacity-90 leading-relaxed">
                定期回顾面试记录，复盘总结是提升面试成功率的关键。
              </p>
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm min-h-[600px] flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                  {currentTabLabel}列表
                  <span className="text-gray-500 text-xs">{total} 条</span>
                </h2>
                <button
                  onClick={() => loadData(activeTab, page)}
                  disabled={isLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                >
                  <Icon name="i-heroicons-arrow-path" className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>

              <div className="p-4 flex-1 relative">
                {isLoading && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center">
                    <Icon name="i-heroicons-arrow-path" className="w-8 h-8 animate-spin text-primary-500 mb-2" />
                    <p className="text-sm text-gray-500">加载数据中...</p>
                  </div>
                )}

                {!isLoading && list.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                      <Icon name="i-heroicons-clipboard-document-list" className="w-10 h-10 text-gray-300" />
                    </div>
                    <h3 className="text-gray-900 font-medium mb-1">暂无相关记录</h3>
                    <p className="text-gray-500 text-sm mb-6">您还没有进行过{currentTabLabel}</p>
                    <Link
                      href="/interview/start"
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      <Icon name="i-heroicons-plus" className="w-4 h-4" />
                      去体验服务
                    </Link>
                  </div>
                )}

                {!isLoading && list.length > 0 && (
                  <div className="space-y-3">
                    {list.map((record: any) => (
                      <div
                        key={record.id || record.resultId}
                        className="group relative bg-white p-4 rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center gap-4"
                      >
                        <div className="flex items-start gap-4 flex-1 min-w-0">
                          <div className="w-12 h-12 rounded-xl bg-gray-50 group-hover:bg-primary-50 text-gray-400 group-hover:text-primary-600 flex items-center justify-center shrink-0 transition-colors">
                            <Icon name="i-heroicons-building-office-2" className="w-6 h-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-semibold text-gray-900 truncate group-hover:text-primary-600 transition-colors">
                                {record.company || '未知公司'}
                              </h3>
                              <span className="text-gray-300 hidden sm:inline">|</span>
                              <span className="text-sm text-gray-600 truncate hidden sm:inline">
                                {record.position || '通用岗位'}
                              </span>
                            </div>
                            <div className="text-sm text-gray-600 truncate sm:hidden mb-1">
                              {record.position || '通用岗位'}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs">
                              <span className="text-gray-400 flex items-center gap-1">
                                <Icon name="i-heroicons-clock" className="w-3.5 h-3.5" />
                                {formatDate(record.createdAt)}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                record.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                              }`}>
                                {record.status === 'success' ? '已完成' : '处理中'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-50 mt-2 sm:mt-0 flex justify-end">
                          <button
                            onClick={() => handleView(record)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-primary-50 hover:text-primary-600 transition-colors group-hover:bg-primary-50 group-hover:text-primary-600"
                          >
                            <Icon name="i-heroicons-eye" className="w-4 h-4" />
                            查看报告
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {total > limit && (
                <div className="px-6 py-4 border-t border-gray-100 flex justify-center items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    上一页
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => handlePageChange(p)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          p === page ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    下一页
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}