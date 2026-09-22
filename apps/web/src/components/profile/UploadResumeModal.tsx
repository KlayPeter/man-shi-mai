'use client'

import React, { useState, useEffect, useRef } from 'react'
import Icon from '@/components/ui/Icon'
import { useUserStore } from '@/stores/userStore'
import { toast } from '@/stores/toastStore'
import { getOSSClient } from '@/utils/oss'
import request from '@/lib/request'

const MAX_RESUME_COUNT = 5
const FILE_SIZE_LIMIT = 5 * 1024 * 1024

interface Props {
  open: boolean
  onClose: () => void
  onUploaded: (resumeId?: string) => void
}

export default function UploadResumeModal({ open, onClose, onUploaded }: Props) {
  const userStore = useUserStore()
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) { setSelectedFile(null); setDragOver(false) }
  }, [open])

  const processFile = (file: File) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const allowedExts = ['.pdf', '.doc', '.docx']
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
      toast({ title: '不支持的文件格式', description: '请上传 PDF、DOC 或 DOCX 格式的文件', color: 'red' })
      return
    }
    if (file.size > FILE_SIZE_LIMIT) {
      toast({ title: '文件大小不能超过 5MB', color: 'red' })
      return
    }
    setSelectedFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024, sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    try {
      const ossClient = await getOSSClient(userStore.token)
      const userId = (userStore.userInfo as any)?._id || 'guest'
      const fileName = `user-resumes/${userId}/${Date.now()}-${selectedFile.name}`
      const ossRes = await ossClient.put(fileName, selectedFile)

      const res = await request.post('/resume/uploadResume', {
        url: ossRes.url,
        resumeName: selectedFile.name,
        uploadTime: new Date().toISOString()
      })
      toast({ title: '上传成功', color: 'green' })
      onUploaded(res.data?._id)
      onClose()
    } catch (e: any) {
      toast({ title: '上传失败', description: e.message || '请稍后重试', color: 'red' })
    } finally {
      setUploading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="font-semibold text-gray-900">上传简历</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <Icon name="i-heroicons-x-mark" className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="px-6 py-6">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-gray-400'} ${uploading ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef} type="file" accept=".pdf,.doc,.docx" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f); e.target.value = '' }}
            />
            {uploading ? (
              <div className="flex flex-col items-center">
                <Icon name="i-heroicons-arrow-path" className="w-12 h-12 mx-auto mb-4 text-primary-500 animate-spin" />
                <p className="text-sm font-medium text-gray-700">上传中...</p>
              </div>
            ) : selectedFile ? (
              <div className="flex flex-col items-center">
                <Icon name="i-heroicons-document-text" className="w-12 h-12 mx-auto mb-4 text-green-500" />
                <p className="text-sm font-medium text-gray-700 mb-1">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">{formatSize(selectedFile.size)}</p>
                <button
                  onClick={e => { e.stopPropagation(); setSelectedFile(null) }}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-700 underline"
                >
                  重新选择
                </button>
              </div>
            ) : (
              <div>
                <Icon name="i-heroicons-folder" className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-sm font-medium text-gray-700 mb-1">点击或拖拽文件到此处上传</p>
                <p className="text-xs text-gray-500">
                  支持 PDF、DOC、DOCX 格式，文件大小不超过 5MB<br />
                  （简历最多支持 {MAX_RESUME_COUNT} 份）
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-2 justify-end">
          <button
            onClick={onClose} disabled={uploading}
            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={handleUpload} disabled={!selectedFile || uploading}
            className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 transition-colors text-sm font-medium"
          >
            {uploading ? '上传中...' : '上传'}
          </button>
        </div>
      </div>
    </div>
  )
}
