'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Icon from '@/components/ui/Icon'
import { useInterviewStore } from '@/stores/interviewStore'
import { useUserStore } from '@/stores/userStore'
import { toast } from '@/stores/toastStore'
import request from '@/lib/request'
import jobCatalog from '@/data/job-categories.json'
import UploadResumeModal from '@/components/profile/UploadResumeModal'

const catalogCategories = (jobCatalog as any).categories ?? []
const allCategories = [
  { key: 'all', label: '全部' },
  ...catalogCategories.map((c: any) => ({ key: c.key, label: c.label }))
]

const allPositions = ((jobCatalog as any).positions ?? []).map((p: any, i: number) => ({
  ...p,
  id: p.positionId || `position-${i}`
}))

const SERVICE_OPTIONS = [
  {
    id: 'resume',
    title: '面试押题',
    badge: '3-5分钟',
    description: '根据岗位JD和简历，精准预测高频面试题，命中率80%+',
    icon: 'i-heroicons-document-text',
    accent: 'bg-blue-50 text-blue-500',
    badgeClass: 'text-blue-700 bg-blue-100',
    route: '/interview?serviceType=resume&step=input'
  },
  {
    id: 'special',
    title: '专项面试模拟',
    badge: '约1小时',
    description: '1v1 AI面试官深度模拟，支持语音/文字多模态作答',
    icon: 'i-heroicons-bolt',
    accent: 'bg-emerald-50 text-emerald-600',
    badgeClass: 'text-emerald-700 bg-emerald-100',
    route: '/interview?serviceType=special&step=input'
  },
  {
    id: 'behavior',
    title: '行测+HR面试',
    badge: '约45分钟',
    description: '综合素质评估，覆盖行测逻辑与HR软技能双维度',
    icon: 'i-heroicons-user-group',
    accent: 'bg-violet-50 text-violet-600',
    badgeClass: 'text-violet-700 bg-violet-100',
    route: '/interview?serviceType=behavior&step=input'
  }
]

export default function InterviewStartPageContent() {
  const router = useRouter()

  const selectedPosition = useInterviewStore(s => s.selectedPosition)
  const resumeId = useInterviewStore(s => s.resumeId)
  const resumeText = useInterviewStore(s => s.resumeText)
  const setSelectedPosition = useInterviewStore(s => s.setSelectedPosition)
  const setResumeId = useInterviewStore(s => s.setResumeId)
  const setResumeText = useInterviewStore(s => s.setResumeText)
  const setSelectedService = useInterviewStore(s => s.setSelectedService)
  const resetStore = useInterviewStore(s => s.reset)

  const resumes = useUserStore(s => s.resumes)
  const updateResumes = useUserStore(s => s.updateResumes)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [showServiceModal, setShowServiceModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [previewResume, setPreviewResume] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchResumes = async () => {
    try {
      const data: any = await request.get('/resume/getInterviewResumeList')
      const list = Array.isArray(data) ? data : (data?.list || [])
      updateResumes(list.map((r: any) => ({ ...r, resumeId: r.resumeId || r._id || r.id })))
    } catch { /* ignore */ }
  }

  const handleDeleteResume = async () => {
    if (!deleteConfirm) return
    setDeleteLoading(true)
    try {
      await request.post('/resume/deleteResume', { resumeId: deleteConfirm.resumeId })
      const newResumes = resumes.filter((r: any) => (r.resumeId || r._id || r.id) !== deleteConfirm.resumeId)
      updateResumes(newResumes)
      if (resumeId === deleteConfirm.resumeId) setResumeId(null)
      toast({ title: '删除成功', color: 'green' })
    } catch (e: any) {
      toast({ title: '删除失败', description: e?.message, color: 'red' })
    } finally {
      setDeleteLoading(false)
      setDeleteConfirm(null)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // 只在没有进行中的面试时才重置
    const currentState = useInterviewStore.getState()
    const hasActiveInterview = currentState.sessionId &&
      (currentState.interviewStatus === 'in_progress' || currentState.interviewStatus === 'starting')

    if (!hasActiveInterview) {
      resetStore?.()
    }
    fetchResumes()
  }, [])

  const filteredPositions = useMemo(() => {
    let result = allPositions
    if (activeCategory !== 'all') {
      result = result.filter((p: any) => p.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter((p: any) =>
        p.positionName?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      )
    }
    return result
  }, [activeCategory, searchQuery])

  const getCategoryLabel = (key: string) =>
    allCategories.find(c => c.key === key)?.label || key

  const handleCategoryFilter = (key: string) => {
    setActiveCategory(key)
    setSearchQuery('')
  }

  const handleSearch = (value: string) => {
    setSearchQuery(value)
    if (value.trim()) setActiveCategory('all')
  }

  const selectPosition = (position: any) => {
    setSelectedPosition(position)
  }

  const clearPosition = () => {
    setSelectedPosition({})
    setSearchQuery('')
    setActiveCategory('all')
  }

  const hasPosition = !!(selectedPosition && selectedPosition.positionId)
  const canProceed = hasPosition && !!(resumeId || resumeText)

  const handleNext = () => {
    if (!canProceed) {
      toast({ title: '请先选择「岗位」和「简历」', color: 'yellow' })
      return
    }
    setShowServiceModal(true)
  }

  const handleSelectService = (service: typeof SERVICE_OPTIONS[0]) => {
    setSelectedService(service.id)
    setShowServiceModal(false)
    router.push(service.route)
  }

  const handleSelectResume = (rid: string) => {
    setResumeId(rid)
    setResumeText('')
  }

  const handleResumeTextChange = (text: string) => {
    setResumeText(text)
    if (text.trim()) setResumeId(null)
  }

  return (
    <div className="h-full flex flex-col gap-6 py-6 px-2">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-center lg:text-left">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 mb-1">选择岗位和导入简历</h1>
          <p className="text-neutral-600 text-sm">锁定目标岗位并导入简历，AI 将定制专属题库</p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-neutral-500 justify-center">
          <Icon name="i-heroicons-sparkles" className="w-4 h-4 text-primary-500" />
          一步完成岗位筛选与资料上传
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col min-h-0">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">选择岗位</h2>

          <div className="relative mb-4">
            <Icon name="i-heroicons-magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              placeholder="搜索岗位名称或描述..."
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <div className="mb-4">
            <p className="text-xs text-neutral-500 mb-2">快速筛选</p>
            <div className="flex flex-wrap gap-2">
              {allCategories.slice(0, showAllCategories ? allCategories.length : 7).map(cat => (
                <button
                  key={cat.key}
                  onClick={() => handleCategoryFilter(cat.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeCategory === cat.key
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
              {allCategories.length > 7 && (
                <button
                  onClick={() => setShowAllCategories(!showAllCategories)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-dashed transition-all ${
                    showAllCategories
                      ? 'border-primary-300 text-primary-700 bg-primary-50/50'
                      : 'border-gray-300 text-neutral-600 hover:border-primary-300 hover:text-primary-600'
                  }`}
                >
                  <Icon name={showAllCategories ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'} className="w-3.5 h-3.5" />
                  {showAllCategories ? '收起' : '更多'}
                  <span className="text-[10px] opacity-60">({allCategories.length - 7})</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <p className="text-xs text-neutral-500 mb-2">
              {filteredPositions.length > 0
                ? `或从下方列表中选择（${filteredPositions.length} 个岗位）`
                : '暂无匹配的岗位，请尝试其他搜索条件'
              }
            </p>
            {filteredPositions.length > 0 ? (
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {filteredPositions.map((position: any) => {
                  const isSelected = position.positionId === selectedPosition?.positionId
                  return (
                    <div
                      key={position.positionId}
                      onClick={() => selectPosition(position)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-primary-300 bg-primary-50/50 shadow-sm'
                          : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50/50 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-neutral-900 text-sm mb-1 truncate">
                            {position.positionName}
                            {getCategoryLabel(position.category) && (
                              <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                                {getCategoryLabel(position.category)}
                              </span>
                            )}
                          </h3>
                          <p className="text-xs text-neutral-600 line-clamp-1">{position.description}</p>
                        </div>
                        <Icon
                          name={isSelected ? 'i-heroicons-check-circle' : 'i-heroicons-chevron-right'}
                          className={`shrink-0 mt-0.5 ${isSelected ? 'w-5 h-5 text-primary-500' : 'w-4 h-4 text-neutral-400'}`}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center py-8">
                <div className="text-center">
                  <Icon name="i-heroicons-magnifying-glass" className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-neutral-400">未找到匹配的岗位</p>
                  <p className="text-xs text-neutral-400 mt-1">尝试调整搜索关键词或选择其他分类</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm flex flex-col min-h-0">
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">
                  选择简历
                  <span className="ml-2 text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                    {resumes.length}/5
                  </span>
                </h2>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Icon name="i-heroicons-plus" className="w-4 h-4" />
                  上传新简历
                </button>
              </div>

              {resumes.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {resumes.map((resume: any) => {
                    const rid = resume.resumeId || resume._id || resume.id
                    const isSelected = resumeId === rid
                    return (
                      <div
                        key={rid}
                        onClick={() => handleSelectResume(rid)}
                        className={`group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary-300 bg-primary-50/50'
                            : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                          <Icon name="i-heroicons-document-text" className="w-5 h-5 text-primary-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-neutral-900 truncate text-sm">{resume.resumeName || resume.filename || '我的简历'}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {resume.createTime ? new Date(resume.createTime).toLocaleDateString('zh-CN') : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setPreviewResume(resume)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="查看简历"
                          >
                            <Icon name="i-heroicons-eye" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ resumeId: rid, resumeName: resume.resumeName || '我的简历' })}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="删除简历"
                          >
                            <Icon name="i-heroicons-trash" className="w-4 h-4" />
                          </button>
                        </div>
                        {isSelected && <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-primary-500 shrink-0" />}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                  <Icon name="i-heroicons-document-text" className="w-10 h-10 mb-2" />
                  <p className="text-sm">暂无简历</p>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="mt-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    立即上传
                  </button>
                </div>
              )}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white px-2 text-gray-500">或</span>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-neutral-900">手动输入简历内容</h3>
              <textarea
                value={resumeText}
                onChange={e => handleResumeTextChange(e.target.value)}
                placeholder="粘贴你的简历内容..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <p className="text-xs text-gray-500">支持直接粘贴简历文本内容，系统将自动解析</p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200 mt-4">
            <button
              onClick={handleNext}
              className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
                canProceed
                  ? 'bg-primary-600 text-white hover:bg-primary-700 shadow-md'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              下一步：开启专项服务
            </button>
          </div>
        </div>
      </div>

      <UploadResumeModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={() => { fetchResumes(); setShowUploadModal(false) }}
      />

      {previewResume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setPreviewResume(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <span className="font-semibold text-gray-900 truncate">{previewResume.resumeName || '简历预览'}</span>
              <button onClick={() => setPreviewResume(null)} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
                <Icon name="i-heroicons-x-mark" className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden m-4 border rounded-lg">
              {previewResume.resumeUrl || previewResume.url ? (
                <iframe src={previewResume.resumeUrl || previewResume.url} className="w-full h-[600px]" />
              ) : (
                <div className="p-12 text-center text-gray-500">
                  <Icon name="i-heroicons-document-text" className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>无法预览此文件</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">确认删除</h3>
            <p className="text-gray-600 text-sm mb-6">确定要删除「{deleteConfirm.resumeName}」吗？删除后无法恢复。</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm disabled:opacity-50">取消</button>
              <button onClick={handleDeleteResume} disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-60">
                {deleteLoading ? '删除中...' : '确定删除'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showServiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowServiceModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">选择下一步体验</h3>
              <p className="text-sm text-gray-500 mt-1">根据目标需求选择想要开启的服务形态</p>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              {SERVICE_OPTIONS.map(service => (
                <button
                  key={service.id}
                  onClick={() => handleSelectService(service)}
                  className="group text-left p-5 rounded-xl border-2 border-gray-200 hover:border-primary-400 hover:shadow-md transition-all"
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-3 ${service.accent}`}>
                    <Icon name={service.icon} className="w-6 h-6" />
                  </div>
                  <h4 className="font-semibold text-gray-900 mb-1">{service.title}</h4>
                  <span className={`inline-block text-xs px-2 py-0.5 rounded-full mb-2 ${service.badgeClass}`}>{service.badge}</span>
                  <p className="text-xs text-gray-500 leading-relaxed">{service.description}</p>
                </button>
              ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
              <button onClick={() => setShowServiceModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
