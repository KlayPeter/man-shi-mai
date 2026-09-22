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
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <AppHeader />
      <main id="main-content" className="flex-1 bg-paper">
        {children}
      </main>
      <Footer />
      <BackToTop />
    </div>
  )
}
