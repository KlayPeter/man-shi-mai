'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, Check, Download, FileText, Loader2 } from 'lucide-react'
import request from '@/lib/request'
import PdfResumePreview from './PdfResumePreview'
import { useUserStore } from '@/stores/userStore'
import type { IResume } from '@/types/resume'

export default function UploadedResumePreview({ resume }: { resume: IResume }) {
  const token = useUserStore(state => state.token)
  const [tab, setTab] = useState<'original' | 'text'>('original')
  const [file, setFile] = useState<{ url: string; type: string; size: number } | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const hasOriginal = Boolean(resume.url || resume.localFileKey)

  useEffect(() => {
    if (!hasOriginal || !token) return
    const controller = new AbortController()
    let objectUrl = ''
    setLoading(true)
    setError('')
    setFile(null)
    request.get<unknown, Blob>(`/resume/file/${resume._id}`, { responseType: 'blob', signal: controller.signal })
      .then(blob => {
        if (controller.signal.aborted) return
        if (!(blob instanceof Blob) || !blob.size) throw new Error('原文件为空')
        objectUrl = URL.createObjectURL(blob)
        setFile({ url: objectUrl, type: blob.type, size: blob.size })
      })
      .catch(() => { if (!controller.signal.aborted) setError('原文件暂时无法加载，你仍可查看已提取的面试内容。') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => { controller.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl) }
  }, [resume._id, hasOriginal, token, attempt])

  const isPdf = file?.type === 'application/pdf'
  const showText = tab === 'text' || !hasOriginal
  const name = resume.originalFileName || resume.resumeName
  const fileName = /\.(pdf|docx)$/i.test(name) ? name : `${name}.${isPdf ? 'pdf' : 'docx'}`

  return <div className="page-container workspace-page max-w-6xl">
    <Link href="/resume" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted hover:text-ink"><ArrowLeft size={16} aria-hidden="true" />我的简历</Link>
    <header className="mb-7 mt-4 flex flex-wrap items-start justify-between gap-5">
      <div className="min-w-0"><p className="eyebrow !mb-2">RESUME / 面试素材</p><h1 className="workspace-heading break-all">{resume.resumeName}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-muted">原文件保留你的排版，提取内容用于面试提问。开始前检查一下，确保没有遗漏。</p></div>
      <Link href={`/interview/start?resumeId=${encodeURIComponent(resume._id)}`} className="button-primary shrink-0">用这份简历练习<ArrowUpRight size={17} aria-hidden="true" /></Link>
    </header>
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-6">
        <div role="group" aria-label="简历查看方式" className="inline-flex rounded-xl bg-paper p-1">
          {hasOriginal && <button type="button" aria-pressed={!showText} onClick={() => setTab('original')} className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors ${!showText ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>原始简历</button>}
          <button type="button" aria-pressed={showText} onClick={() => setTab('text')} className={`min-h-11 rounded-lg px-4 text-sm font-medium transition-colors ${showText ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>面试使用的内容</button>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted">
          {file && <><span className="hidden sm:inline">{isPdf ? 'PDF' : 'DOCX'} · {Math.max(1, Math.round(file.size / 1024))} KB</span><a href={file.url} download={fileName} className="inline-flex min-h-11 items-center gap-1.5 text-ink hover:text-primary-600"><Download size={15} aria-hidden="true" />下载简历</a><a href={file.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-ink hover:text-primary-600">打开原文件<ArrowUpRight size={15} aria-hidden="true" /></a></>}
        </div>
      </div>
      {showText ? <section aria-label="简历提取内容" className="bg-paper px-4 py-6 sm:px-10 sm:py-8">
        <div className="mx-auto max-w-[760px] rounded-sm border border-line bg-white px-6 py-8 shadow-sm sm:px-12 sm:py-12">
          <div className="mb-7 flex items-center gap-2 border-b border-line pb-5 text-sm font-medium text-primary-700"><Check size={16} aria-hidden="true" />面试官会参考以下文字</div>
          {resume.plainTextSnapshot ? <div className="whitespace-pre-wrap break-words text-sm leading-8 text-ink">{resume.plainTextSnapshot}</div> : <p className="text-sm leading-7 text-muted">这份历史文件还没有提取内容。请重新上传文本型 PDF 或 DOCX，再检查解析结果。</p>}
        </div>
      </section> : <section aria-label="原始简历预览" className="bg-sand p-3 sm:p-6">
        {loading && <div role="status" className="flex min-h-[540px] flex-col items-center justify-center gap-3 text-sm text-muted"><Loader2 size={24} className="animate-spin" aria-hidden="true" />正在加载原始简历…</div>}
        {error && <div role="alert" className="mx-auto flex min-h-[360px] max-w-md flex-col items-center justify-center gap-5 text-center"><FileText size={30} className="text-muted" aria-hidden="true" /><p className="text-sm leading-7 text-muted">{error}</p><div className="flex gap-3"><button type="button" onClick={() => setAttempt(value => value + 1)} className="button-secondary">重新加载</button><button type="button" onClick={() => setTab('text')} className="button-primary">查看提取内容</button></div></div>}
        {file && !error && (isPdf ? <><PdfResumePreview url={file.url} /><p className="mt-4 text-center text-xs leading-6 text-muted">预览保留 PDF 原始排版；需要放大查看时，可使用上方“打开原文件”。</p></> : <div className="mx-auto flex min-h-[360px] max-w-md flex-col items-center justify-center gap-5 text-center"><FileText size={36} className="text-primary-600" aria-hidden="true" /><h2 className="text-lg font-semibold text-ink">DOCX 已上传并解析</h2><p className="text-sm leading-7 text-muted">浏览器无法直接还原 Word 排版。你可以下载原文件，或检查面试官会使用的提取内容。</p><button type="button" onClick={() => setTab('text')} className="button-primary">查看面试使用的内容<ArrowUpRight size={16} aria-hidden="true" /></button></div>)}
      </section>}
    </div>
    <p className="mt-4 text-xs leading-6 text-muted">原文件仅在登录后加载。提取内容用于核对，不会修改你的原始简历。</p>
  </div>
}
