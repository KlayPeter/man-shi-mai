'use client'

import React, { ReactNode } from 'react'
import AppHeader from '@/components/AppHeader'
import Footer from '@/components/Footer'
import BackToTop from '@/components/BackToTop'

interface DefaultLayoutProps {
  children: ReactNode
}

export default function DefaultLayout({ children }: DefaultLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader />
      <main className="flex-1 bg-gray-50">
        {children}
      </main>
      <Footer />
      <BackToTop />
    </div>
  )
}
