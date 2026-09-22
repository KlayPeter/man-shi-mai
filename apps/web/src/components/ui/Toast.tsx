'use client'

import React, { useEffect, useState } from 'react'
import { useToastStore, ToastItem } from '@/stores/toastStore'

const colorMap = {
  green: 'bg-green-50 border-green-200 text-green-800',
  red: 'bg-red-50 border-red-200 text-red-800',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  blue: 'bg-blue-50 border-blue-200 text-blue-800',
  gray: 'bg-gray-50 border-gray-200 text-gray-800',
}

const iconMap = {
  green: (
    <svg className="w-5 h-5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  red: (
    <svg className="w-5 h-5 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  yellow: (
    <svg className="w-5 h-5 text-yellow-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
    </svg>
  ),
  blue: (
    <svg className="w-5 h-5 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
    </svg>
  ),
  gray: (
    <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
    </svg>
  ),
}

function ToastCard({ item }: { item: ToastItem }) {
  const [visible, setVisible] = useState(false)
  const remove = useToastStore((s) => s.remove)
  const color = item.color ?? 'gray'

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-sm
        transition-all duration-300 ease-out min-w-[280px] max-w-sm
        ${colorMap[color]}
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      {iconMap[color]}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug">{item.title}</p>
        {item.description && (
          <p className="text-xs mt-0.5 opacity-80 leading-snug">{item.description}</p>
        )}
      </div>
      <button
        onClick={() => remove(item.id)}
        className="shrink-0 opacity-50 hover:opacity-100 transition-opacity ml-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)

  return (
    <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard item={item} />
        </div>
      ))}
    </div>
  )
}
