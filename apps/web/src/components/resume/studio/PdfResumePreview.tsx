'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'

export default function PdfResumePreview({ url }: { url: string }) {
  const container = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(1)
  const [width, setWidth] = useState(0)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!container.current) return
    const observer = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)))
    observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let disposed = false
    let task: ReturnType<typeof import('pdfjs-dist').getDocument> | undefined
    setError('')
    setDocument(null)
    setPage(1)
    setRendering(true)
    // Native ESM keeps the PDF.js module and worker on the same version.
    const moduleUrl = '/pdfjs/pdf.mjs'
    void (import(/* webpackIgnore: true */ moduleUrl) as Promise<typeof import('pdfjs-dist')>).then(pdfjs => {
      if (disposed) return
      pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'
      task = pdfjs.getDocument({ url, isEvalSupported: false, enableXfa: false, cMapUrl: '/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/' })
      return task.promise.then(value => { if (!disposed) setDocument(value) })
    }).catch(() => { if (!disposed) { setError('PDF 暂时无法显示，请重试，或下载原文件后查看。'); setRendering(false) } })
    return () => { disposed = true; void task?.destroy() }
  }, [url, attempt])

  useEffect(() => {
    if (!document || !canvas.current || !width) return
    let disposed = false
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy['getPage']>>['render']> | undefined
    const target = canvas.current
    setRendering(true)
    setError('')
    void document.getPage(page).then(pdfPage => {
      if (disposed) return
      const viewport = pdfPage.getViewport({ scale: Math.min(width * Math.min(window.devicePixelRatio || 1, 2), 1800) / pdfPage.getViewport({ scale: 1 }).width })
      const context = target.getContext('2d')
      if (!context) throw new Error('Canvas unavailable')
      target.width = Math.ceil(viewport.width)
      target.height = Math.ceil(viewport.height)
      task = pdfPage.render({ canvas: target, canvasContext: context, viewport })
      return task.promise
    }).then(() => { if (!disposed) setRendering(false) }).catch(() => {
      if (!disposed) { setRendering(false); setError('这一页暂时无法显示，请重试，或下载原文件后查看。') }
    })
    return () => { disposed = true; task?.cancel() }
  }, [document, page, width])

  return <div className="mx-auto max-w-[860px]">
    <div ref={container} className="relative min-h-[240px] overflow-hidden rounded-sm border border-line bg-white shadow-sm">
      {rendering && !error && <div role="status" className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-white/90 text-sm text-muted"><Loader2 size={20} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />正在显示 PDF…</div>}
      {error ? <div role="alert" className="flex min-h-[300px] flex-col items-center justify-center gap-4 px-6 text-center"><p className="text-sm leading-7 text-muted">{error}</p><button type="button" onClick={() => setAttempt(value => value + 1)} className="button-secondary">重新显示</button></div> : <canvas ref={canvas} role="img" aria-label={`原始 PDF 简历，第 ${page} 页。文字内容可在“面试使用的内容”中读取。`} className="block h-auto w-full" />}
    </div>
    {document && <div className="mt-4 flex items-center justify-center gap-4 text-sm text-muted"><button type="button" aria-label="上一页简历" disabled={page <= 1 || rendering} onClick={() => setPage(value => value - 1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-white disabled:opacity-30"><ChevronLeft size={18} aria-hidden="true" /></button><span aria-live="polite">第 {page} / {document.numPages} 页</span><button type="button" aria-label="下一页简历" disabled={page >= document.numPages || rendering} onClick={() => setPage(value => value + 1)} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-line bg-white disabled:opacity-30"><ChevronRight size={18} aria-hidden="true" /></button></div>}
  </div>
}
