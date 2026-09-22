import { Suspense } from 'react'
import ReportPageContent from './page.client'

export const dynamic = 'force-dynamic'

export default function ReportPage() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center"><div className="text-neutral-400">加载中...</div></div>}>
      <ReportPageContent />
    </Suspense>
  )
}
