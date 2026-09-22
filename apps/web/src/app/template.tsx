'use client'

import React, { useEffect, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useUserStore } from '@/stores/userStore'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import InterviewLayout from '@/components/layouts/InterviewLayout'
import ToastContainer from '@/components/ui/Toast'

const NO_LAYOUT_PATHS = ['/login']

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hydrate = useUserStore(state => state.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const noLayout = NO_LAYOUT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  const interviewLayout = pathname === '/interview/report'
  return (
    <>
      {noLayout
        ? <>{children}</>
        : pathname === '/interview'
        ? <Suspense fallback={null}><InterviewRouteLayout>{children}</InterviewRouteLayout></Suspense>
        : interviewLayout
        ? <InterviewLayout>{children}</InterviewLayout>
        : <DefaultLayout>{children}</DefaultLayout>
      }
      <ToastContainer />
    </>
  )
}

function InterviewRouteLayout({ children }: { children: React.ReactNode }) {
  const params = useSearchParams()
  return (params.get('step') || 'input') === 'input'
    ? <DefaultLayout>{children}</DefaultLayout>
    : <InterviewLayout>{children}</InterviewLayout>
}
