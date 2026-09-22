import { Suspense } from 'react'
import LoginPageContent from './page.client'

export const dynamic = 'force-dynamic'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-neutral-900"><div className="text-white">加载中...</div></div>}>
      <LoginPageContent />
    </Suspense>
  )
}
