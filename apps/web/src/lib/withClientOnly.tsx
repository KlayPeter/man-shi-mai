'use client'

import React, { Suspense } from 'react'

export function withClientOnly<P extends object>(Component: React.ComponentType<P>) {
  return function ClientOnlyWrapper(props: P) {
    return (
      <Suspense fallback={<div className="h-full flex items-center justify-center"><div className="text-neutral-400">加载中...</div></div>}>
        <Component {...props} />
      </Suspense>
    )
  }
}
