'use client'

import React, { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Icon from '@/components/ui/Icon'
import { useUserStore } from '@/stores/userStore'
import { toast } from '@/stores/toastStore'
import { getOSSClient } from '@/utils/oss'
import request from '@/lib/request'

interface Props {
  open: boolean
  onClose: () => void
}

export default function EditProfileModal({ open, onClose }: Props) {
  const userStore = useUserStore()
  const [form, setForm] = useState({ username: '', email: '', avatar: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setForm({
        username: userStore.userInfo?.username || '',
        email: userStore.userInfo?.email || '',
        avatar: userStore.userInfo?.avatar || ''
      })
      setError('')
    }
  }, [open, userStore.userInfo])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast({ title: '请选择图片文件', color: 'red' })
      e.target.value = ''
      return
    }
    if (file.size > 500 * 1024) {
      toast({ title: '图片大小不能超过 500KB', color: 'red' })
      e.target.value = ''
      return
    }
    setAvatarUploading(true)
    try {
      const ossClient = await getOSSClient(userStore.token)
      const userId = (userStore.userInfo as any)?.openid || (userStore.userInfo as any)?._id || 'guest'
      const ext = file.type.split('/').pop()
      const fileName = `user-img/${userId}/${Date.now()}.${ext}`
      const ossRes = await ossClient.put(fileName, file)
      setForm(f => ({ ...f, avatar: ossRes.url }))
    } catch (err: any) {
      toast({ title: '头像上传失败', description: err.message, color: 'red' })
    } finally {
      setAvatarUploading(false)
      e.target.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!form.username.trim()) { setError('请输入用户名'); return }
    if (form.username.trim().length < 2) { setError('用户名至少需要2个字符'); return }
    if (form.username.trim().length > 20) { setError('用户名不能超过20个字符'); return }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError('请输入有效的邮箱地址'); return
    }
    setLoading(true)
    try {
      await request.post('/user/update', {
        username: form.username.trim(),
        email: form.email.trim(),
        avatar: form.avatar
      })
      userStore.updateUserInfo({ username: form.username.trim(), email: form.email.trim(), avatar: form.avatar })
      toast({ title: '个人信息修改成功', color: 'green' })
      onClose()
    } catch (err: any) {
      const msg = err.message || '保存失败，请稍后重试'
      setError(msg)
      toast({ title: '保存失败', description: msg, color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="font-semibold text-gray-900">编辑个人信息</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <Icon name="i-heroicons-x-mark" className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* 头像上传 */}
          <div className="flex flex-col items-center">
            <div className="relative group mb-4">
              {form.avatar ? (
                <Image src={form.avatar} alt="头像" width={80} height={80}
                  className="w-20 h-20 rounded-full object-cover ring-4 ring-primary-100" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-2xl font-bold ring-4 ring-primary-100">
                  {form.username?.charAt(0)?.toUpperCase() || 'U'}
                </div>
              )}
              {avatarUploading ? (
                <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <Icon name="i-heroicons-arrow-path" className="w-6 h-6 text-white animate-spin" />
                </div>
              ) : (
                <div
                  className="absolute inset-0 rounded-full bg-gradient-to-t from-black/60 to-black/40 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center text-white text-xs transition-all cursor-pointer"
                  onClick={() => avatarRef.current?.click()}
                >
                  <Icon name="i-heroicons-camera" className="w-5 h-5 mb-1" />
                  <span className="text-[10px]">更换</span>
                </div>
              )}
            </div>
            <button
              onClick={() => avatarRef.current?.click()}
              disabled={avatarUploading}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50"
            >
              更换头像
            </button>
            <p className="text-xs text-gray-500 mt-1 text-center">支持 JPG、PNG 格式，文件大小不超过 500kb</p>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">用户名</label>
            <input
              type="text"
              value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
              placeholder="请输入用户名（2-20个字符）"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="请输入您的邮箱地址"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none transition text-sm"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors text-sm font-medium shadow-md"
          >
            {loading ? '保存中...' : '保存更改'}
          </button>
        </div>
      </div>
    </div>
  )
}
