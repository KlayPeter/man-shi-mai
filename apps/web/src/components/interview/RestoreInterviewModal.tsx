'use client'

import React from 'react'
import Icon from '@/components/ui/Icon'

interface RestoreInterviewModalProps {
  open: boolean
  serviceType: string
  onRestore: () => void
  onDiscard: () => void
}

const serviceLabels: Record<string, string> = {
  resume: '面试押题',
  special: '专项面试模拟',
  behavior: '行测+HR面试'
}

export default function RestoreInterviewModal({ open, serviceType, onRestore, onDiscard }: RestoreInterviewModalProps) {
  if (!open) return null

  const serviceName = serviceLabels[serviceType] || '面试'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <Icon name="i-heroicons-exclamation-triangle" className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">检测到未完成的{serviceName}</h3>
              <p className="text-xs text-gray-500 mt-0.5">是否继续上次的面试？</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex gap-3">
              <Icon name="i-heroicons-information-circle" className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">我们为您保存了上次的面试进度</p>
                <p className="text-blue-700">您可以选择继续完成，或者重新开始一次新的面试。</p>
              </div>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-lg p-4">
            <div className="flex gap-3">
              <Icon name="i-heroicons-exclamation-circle" className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-900">
                <p className="font-medium mb-1">重要提示</p>
                <p className="text-red-700">如果选择放弃，本次面试机会将被消耗，无法恢复。建议继续完成以充分利用您的权益。</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onDiscard}
            className="flex-1 py-2.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            放弃并重新开始
          </button>
          <button
            onClick={onRestore}
            className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <Icon name="i-heroicons-arrow-path" className="w-4 h-4" />
            继续面试
          </button>
        </div>
      </div>
    </div>
  )
}
