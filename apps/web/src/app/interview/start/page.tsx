import { Suspense } from 'react'
import InterviewStartPageContent from './page.client'

export const dynamic = 'force-dynamic'

export default function InterviewStartPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center"><div className="text-neutral-400">加载中...</div></div>}>
      <InterviewStartPageContent />
    </Suspense>
  )
}
