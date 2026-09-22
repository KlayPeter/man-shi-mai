'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Icon from '@/components/ui/Icon'

interface AuthPromptModalProps {
  show: boolean
  onClose: () => void
}

export default function AuthPromptModal({ show, onClose }: AuthPromptModalProps) {
  const router = useRouter()

  if (!show) return null

  const handleLogin = () => {
    onClose()
    router.push('/login')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
            <Icon name="i-heroicons-user" className="w-8 h-8 text-primary-600" />
          </div>
          <h3 className="text-xl font-semibold text-neutral-900 mb-2">请先登录</h3>
          <p className="text-neutral-600 mb-6">
            登录后即可使用完整的面试服务功能
          </p>
          <div className="flex gap-3">
            <Button
              color="gray"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              取消
            </Button>
            <Button
              color="primary"
              onClick={handleLogin}
              className="flex-1"
            >
              去登录
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
