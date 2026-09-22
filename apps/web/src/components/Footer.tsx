'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import SvgIcon from '@/components/SvgIcon'
import Icon from '@/components/ui/Icon'

export default function Footer() {
  const [copySuccess, setCopySuccess] = useState(false)

  const copyWeChat = async () => {
    const wechatId = 'mmx13025593963'
    try {
      await navigator.clipboard.writeText(wechatId)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      const textArea = document.createElement('textarea')
      textArea.value = wechatId
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (fallbackErr) {
        alert('复制失败，请手动复制：' + wechatId)
      }
      document.body.removeChild(textArea)
    }
  }

  return (
    <footer className="border-t border-gray-200 bg-white">
      <div className="container px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">
              关于我
            </h3>
            <div className="flex items-center gap-2 mb-3">
              <Image
                src="/logo.png"
                alt="面试麦"
                width={24}
                height={24}
                className="h-6 w-6"
              />
              <span className="text-base font-semibold text-neutral-900">
                面试麦
              </span>
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">
              极简三步，完成 AI 面试。专业的 AI 面试平台，帮助您更好地准备面试。
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">
              快速链接
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/interview/start"
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  开始 AI 面试
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  常见问题
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  关于我
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">
              关于我
            </h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 text-neutral-600">
                <Icon
                  name="i-heroicons-chat-bubble-left-right"
                  className="w-4 h-4 text-green-600 shrink-0"
                />
                <span>微信：</span>
                <button
                  onClick={copyWeChat}
                  className="font-mono hover:text-neutral-900 transition-colors"
                >
                  mmx13025593963
                </button>
                {copySuccess && (
                  <span className="text-green-600 text-xs">已复制</span>
                )}
              </li>
              <li className="flex items-center gap-2 text-neutral-600">
                <Icon
                  name="i-heroicons-envelope"
                  className="w-4 h-4 text-blue-600 shrink-0"
                />
                <a
                  href="mailto:kt_mmxyy2377@qq.com"
                  className="font-mono hover:text-neutral-900 transition-colors"
                >
                  kt_mmxyy2377@qq.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-neutral-500">
            <div className="flex flex-col md:flex-row items-center gap-4">
              <p>© {new Date().getFullYear()} 面试麦 · AI 面试平台</p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/agreement"
                className="hover:text-neutral-700 transition-colors"
              >
                用户协议
              </Link>
              <span>|</span>
              <Link
                href="/policy"
                className="hover:text-neutral-700 transition-colors"
              >
                隐私政策
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
