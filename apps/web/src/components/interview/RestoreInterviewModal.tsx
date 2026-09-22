'use client'

import { useEffect, useRef } from 'react'
import Icon from '@/components/ui/Icon'

interface RestoreInterviewModalProps {
  open: boolean
  serviceType: string
  onRestore: () => void
  onDiscard: () => void
}

export default function RestoreInterviewModal({ open, serviceType, onRestore, onDiscard }: RestoreInterviewModalProps) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current
    if (open) element?.showModal()
    else element?.close()
    return () => element?.close()
  }, [open])

  return <dialog ref={dialog} aria-labelledby="restore-interview-title" onCancel={onDiscard}
    className="m-auto w-[calc(100%-2rem)] max-w-md rounded-3xl border border-line bg-paper p-6 text-ink shadow-2xl backdrop:bg-black/40 sm:p-8">
    <p className="eyebrow">{serviceType === 'behavior' ? '综合面试' : '专项面试'}</p>
    <h2 id="restore-interview-title" className="mt-2 text-2xl font-semibold">回到这场面试</h2>
    <p className="mt-2 text-sm text-muted">读取已保存的问答，接着练习。</p>
    <div className="my-7 flex items-center justify-center gap-5" aria-label="读取记录，然后继续回答">
      <div className="flex flex-col items-center gap-2 text-sm">
        <span className="grid h-14 w-14 place-items-center rounded-2xl border border-line bg-white"><Icon name="i-heroicons-document-text" className="h-6 w-6 text-primary-600" /></span>
        读取记录
      </div>
      <Icon name="i-heroicons-arrow-right" className="h-5 w-5 text-muted" />
      <div className="flex flex-col items-center gap-2 text-sm">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary-50"><Icon name="i-heroicons-microphone" className="h-6 w-6 text-primary-600" /></span>
        继续回答
      </div>
    </div>
    <div className="flex gap-3">
      <button type="button" onClick={onDiscard} className="min-h-11 flex-1 rounded-xl border border-line text-sm">返回准备</button>
      <button type="button" onClick={onRestore} className="min-h-11 flex-1 rounded-xl bg-primary-600 text-sm font-medium text-white">继续面试</button>
    </div>
  </dialog>
}
