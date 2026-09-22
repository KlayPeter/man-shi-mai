'use client'

import React, { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useUserStore } from '@/stores/userStore'
import DefaultLayout from '@/components/layouts/DefaultLayout'
import InterviewLayout from '@/components/layouts/InterviewLayout'
import ToastContainer from '@/components/ui/Toast'

const NO_LAYOUT_PATHS = ['/login']
const INTERVIEW_LAYOUT_PATHS = ['/interview']

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const hydrate = useUserStore(state => state.hydrate)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  const noLayout = NO_LAYOUT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  const interviewLayout = INTERVIEW_LAYOUT_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))
  return (
    <>
      {noLayout
        ? <>{children}</>
        : interviewLayout
        ? <InterviewLayout>{children}</InterviewLayout>
        : <DefaultLayout>{children}</DefaultLayout>
      }
      <ToastContainer />
    </>
  )
}
