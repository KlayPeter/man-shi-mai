'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useMemo, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

export default function InterviewStartPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const selectedPosition = useInterviewStore(s => s.selectedPosition)
  const resumeId = useInterviewStore(s => s.resumeId)
  const resumeText = useInterviewStore(s => s.resumeText)
  const setSelectedPosition = useInterviewStore(s => s.setSelectedPosition)
  const setResumeId = useInterviewStore(s => s.setResumeId)
  const setResumeText = useInterviewStore(s => s.setResumeText)
  const setSelectedService = useInterviewStore(s => s.setSelectedService)
  const selectedService = useInterviewStore(s => s.selectedService)
  const pendingStart = useInterviewStore(s => s.pendingStart)
  const activeResult = useInterviewStore(s => s.resultId)
  const activeStatus = useInterviewStore(s => s.interviewStatus)

  const resumes = useUserStore(s => s.resumes)
  const updateResumes = useUserStore(s => s.updateResumes)

  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [showAllCategories, setShowAllCategories] = useState(false)
  const [resumeLoading, setResumeLoading] = useState(true)
  const [resumeError, setResumeError] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [previewResume, setPreviewResume] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<any>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchResumes = async () => {
    setResumeLoading(true)
    setResumeError('')
    try {
      const data: unknown = await request.get('/resume/getInterviewResumeList')
      const raw = Array.isArray(data) ? data : data && typeof data === 'object' && 'list' in data ? data.list : null
      if (!Array.isArray(raw)) throw new Error('简历列表响应无效')
      const list = raw.map((value: unknown) => {
        if (!value || typeof value !== 'object') throw new Error('简历记录无效')
        const r = value as Record<string, unknown>
        const id = r.resumeId || r._id || r.id
        if (typeof id !== 'string') throw new Error('简历标识缺失')
        return { ...r, resumeId: id }
      })
      updateResumes(list)
      const requestedResume = searchParams.get('resumeId')
      if (requestedResume && list.some((r: { resumeId?: string; _id?: string; id?: string }) => (r.resumeId || r._id || r.id) === requestedResume)) {
        const state = useInterviewStore.getState()
        if (!state.resumeId && !state.resumeText && !state.sessionId) setResumeId(requestedResume)
      }
    } catch { setResumeError('简历加载失败。可以重试、粘贴经历或直接练习。') }
    finally { setResumeLoading(false) }
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
    setSelectedPosition({ ...selectedPosition, ...position })
  }

  const clearPosition = () => {
    setSelectedPosition({})
    setSearchQuery('')
    setActiveCategory('all')
  }

  const hasPosition = !!(selectedPosition && selectedPosition.positionId)
  const canProceed = hasPosition
  const hasActive = !!pendingStart || (!!activeResult && ['in_progress', 'starting', 'suspend'].includes(activeStatus))
  const handleNext = () => {
    if (hasActive) {
      const type = pendingStart?.interviewType || selectedService || 'special'
      router.push(`/interview?serviceType=${type}&step=interview${activeResult ? `&resultId=${encodeURIComponent(activeResult)}&restore=true` : ''}`)
      return
    }
    if (!canProceed) return
    useInterviewStore.getState().resetInterview()
    useInterviewStore.setState({ resultId: null })
    const type = selectedService === 'behavior' ? 'behavior' : 'special'
    setSelectedService(type)
    router.push(`/interview?serviceType=${type}&step=input`)
  }
  const openPrediction = () => {
    if (!hasPosition || !(resumeId || resumeText.trim())) {
      toast({ title: '提前押题需要目标岗位与简历或经历文本', color: 'yellow' }); return
    }
    setSelectedService('resume')
    router.push('/interview?serviceType=resume&step=input')
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
    <div className="page-container flex flex-col gap-6 py-8 lg:py-12">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-left">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink mb-3">把下一场面试，先练一遍。</h1>
          <p className="text-neutral-600 text-sm">选好岗位就能开始。带上经历，让提问更贴近你。</p>
        </div>
        <div className="inline-flex items-center gap-2 text-xs text-neutral-500 justify-center">
          <Icon name="i-heroicons-sparkles" className="w-4 h-4 text-primary-500" />
          准备 → 试音 → 面试 → 复盘
        </div>
      </div>

      {hasActive && <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 p-4"><p className="text-sm text-primary-900">你还有一场待继续的面试，先回去接着聊。</p><button onClick={handleNext} className="min-h-11 text-sm font-semibold text-primary-800">继续上次面试 →</button></div>}
      <div className="start-grid lg:h-[720px] lg:flex-none lg:grid-rows-[minmax(0,1fr)]">
        <div className="start-panel">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4"><span className="mr-2 text-primary-500">01</span> 选择目标岗位</h2>

          <div className="relative mb-4">
            <Icon name="i-heroicons-magnifying-glass" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              aria-label="搜索目标岗位"
              placeholder="试试搜索：前端开发、产品经理…"
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>

          <div className="mb-4">
            <p className="text-xs text-neutral-500 mb-2">快速筛选</p>
            <div className="flex flex-wrap gap-2">
              {allCategories.slice(0, showAllCategories ? allCategories.length : 7).map(cat => (
                <button
                  key={cat.key}
                  aria-pressed={activeCategory === cat.key}
                  onClick={() => handleCategoryFilter(cat.key)}
                  className={`min-h-11 px-3 py-2 text-xs font-medium rounded-lg transition-colors ${
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
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      key={position.positionId}
                      onClick={() => selectPosition(position)}
                      className={`w-full text-left p-3 rounded-lg border cursor-pointer transition-all ${
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
                    </button>
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

        <div className="start-panel">
          <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-neutral-900">
                  <span className="mr-2 text-primary-500">02</span> 带上经历（可选）
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

              {resumeLoading ? <p role="status" className="rounded-xl bg-paper p-6 text-sm text-muted">正在读取你的简历…</p> : resumeError ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p>{resumeError}</p><button type="button" onClick={() => void fetchResumes()} className="mt-2 min-h-11 font-semibold underline">重试加载简历</button></div> : resumes.length > 0 ? (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {resumes.map((resume: any) => {
                    const rid = resume.resumeId || resume._id || resume.id
                    const isSelected = resumeId === rid
                    return (
                      <div
                        key={rid}
                        className={`group flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary-300 bg-primary-50/50'
                            : 'border-gray-200 hover:border-primary-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center shrink-0">
                          <Icon name="i-heroicons-document-text" className="w-5 h-5 text-primary-600" />
                        </div>
                        <button type="button" aria-pressed={isSelected} onClick={() => handleSelectResume(rid)} className="flex-1 min-w-0 min-h-11 text-left">
                          <p className="font-medium text-neutral-900 truncate text-sm">{resume.resumeName || resume.filename || '我的简历'}</p>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {resume.createTime ? new Date(resume.createTime).toLocaleDateString('zh-CN') : ''}
                          </p>
                        </button>
                        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => setPreviewResume(resume)}
                            className="icon-button hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="查看简历"
                          >
                            <Icon name="i-heroicons-eye" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirm({ resumeId: rid, resumeName: resume.resumeName || '我的简历' })}
                            className="icon-button hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
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
                  <p className="text-sm">还没有简历？也可以直接练习</p>
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
                aria-label="简历文本内容"
                placeholder="粘贴你的工作经历、项目经验与技能…"
                rows={4}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted">{resumeId || resumeText.trim() ? '将根据你的经历展开提问' : '未提供经历，将按岗位通用问题练习'}</p>{(resumeId || resumeText) && <button type="button" onClick={() => { setResumeId(null); setResumeText('') }} className="min-h-11 text-xs text-primary-700">清除，先做通用练习</button>}</div>
            </div>
            <details className="rounded-xl border border-line p-4"><summary className="cursor-pointer text-sm font-semibold text-ink">补充目标公司 / 岗位要求（可选）</summary>
              <div className="mt-4 space-y-3"><label className="block text-sm text-muted">目标公司<input value={selectedPosition.company || ''} maxLength={100} onChange={event => setSelectedPosition({ ...selectedPosition, company: event.target.value })} className="mt-2 w-full rounded-lg border border-line p-3 text-ink" /></label>
              <label className="block text-sm text-muted">岗位要求（JD）<textarea value={selectedPosition.jd || ''} maxLength={2000} rows={4} onChange={event => setSelectedPosition({ ...selectedPosition, jd: event.target.value })} className="mt-2 w-full rounded-lg border border-line p-3 text-ink" /></label></div>
            </details>
            <div>
            </div>
          </div>

          <div className="mt-4 space-y-3 border-t border-line pt-4">
            <h3 className="text-sm font-semibold text-ink">这次重点练什么？</h3>
            <div role="group" aria-label="考察类型" className="grid grid-cols-2 gap-2">
              {([{ id: 'special', title: '专业能力', icon: 'i-heroicons-briefcase' }, { id: 'behavior', title: 'HR / 行为', icon: 'i-heroicons-user-group' }] as const).map(option => <button key={option.id} type="button" aria-pressed={(selectedService === 'behavior' ? 'behavior' : 'special') === option.id} onClick={() => setSelectedService(option.id)} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm ${(selectedService === 'behavior' ? 'behavior' : 'special') === option.id ? 'border-primary-500 bg-primary-50 text-primary-900' : 'border-line text-muted'}`}><Icon name={option.icon} className="h-4 w-4" />{option.title}</button>)}
            </div>
            <button onClick={handleNext} disabled={!canProceed && !hasActive} className="button-primary w-full justify-center disabled:cursor-not-allowed disabled:opacity-50">{hasActive ? '继续上次面试' : '准备好了，去候场'}<Icon name="i-heroicons-arrow-right" className="h-4 w-4" /></button>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted"><span>准备与试音不扣次</span><button type="button" disabled={hasActive} onClick={openPrediction} className="min-h-11 text-primary-700 underline disabled:opacity-50">只想提前押题？</button></div>
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


    </div>
  )
}
