import { Suspense } from 'react'
import InterviewPageContent from './page.client'

export const dynamic = 'force-dynamic'

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center"><div className="text-neutral-400">加载中...</div></div>}>
      <InterviewPageContent />
    </Suspense>
  )
}
