'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import Icon from '@/components/ui/Icon'

export default function ContactPage() {
  const [copySuccess, setCopySuccess] = useState(false)
  const email = 'kt_mmxyy2377@qq.com'
  const wechatId = 'mmx13025593963'

  const copyWeChat = async () => {
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
    <section className="container py-12 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-neutral-900">关于我</h1>
        <p className="mt-2 text-sm text-neutral-500">
          有任何问题或建议，欢迎通过以下方式联系我们
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center text-center h-full">
            <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mb-4">
              <Icon
                name="i-heroicons-globe-alt"
                className="w-8 h-8 text-purple-600"
              />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              个人网站
            </h2>
            <p className="text-sm text-neutral-500 mb-4">
              访问我的个人网站了解更多
            </p>
            <div className="mt-auto w-full">
              <a
                href="https://mmx-dev.vercel.app/#/"
                target="_blank"
                rel="noopener noreferrer"
                className="block bg-gray-50 rounded-lg border border-gray-200 p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-neutral-900 break-all">
                    mmx-dev.vercel.app
                  </span>
                  <Icon
                    name="i-heroicons-arrow-top-right-on-square"
                    className="w-5 h-5 text-neutral-400 flex-shrink-0 ml-2"
                  />
                </div>
              </a>
              <p className="text-xs text-neutral-400 mt-2">点击访问网站</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center text-center h-full">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
              <Icon
                name="i-heroicons-chat-bubble-left-right"
                className="w-8 h-8 text-green-600"
              />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              微信添加好友
            </h2>
            <p className="text-sm text-neutral-500 mb-4">
              添加微信好友进行咨询
            </p>
            <div className="mt-auto w-full">
              <div
                className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-2 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={copyWeChat}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-neutral-900 break-all">
                    {wechatId}
                  </span>
                  <Icon
                    name="i-heroicons-clipboard-document"
                    className="w-5 h-5 text-neutral-400"
                  />
                </div>
              </div>
              <p className="text-xs text-neutral-400">
                {copySuccess ? '已复制到剪贴板' : '点击复制微信号'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex flex-col items-center text-center h-full">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <Icon
                name="i-heroicons-envelope"
                className="w-8 h-8 text-blue-600"
              />
            </div>
            <h2 className="text-xl font-semibold text-neutral-900 mb-2">
              邮箱联系
            </h2>
            <p className="text-sm text-neutral-500 mb-4">
              发送邮件与我们取得联系
            </p>
            <div className="mt-auto w-full">
              <a
                href={`mailto:${email}`}
                className="block bg-gray-50 rounded-lg border border-gray-200 p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm text-neutral-900 break-all">
                    {email}
                  </span>
                  <Icon
                    name="i-heroicons-arrow-top-right-on-square"
                    className="w-5 h-5 text-neutral-400 flex-shrink-0 ml-2"
                  />
                </div>
              </a>
              <p className="text-xs text-neutral-400 mt-2">点击发送邮件</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-12 bg-gray-50 rounded-lg border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-neutral-900 mb-4">
          联系说明
        </h2>
        <ul className="space-y-2 text-sm text-neutral-600">
          <li className="flex items-start">
            <Icon
              name="i-heroicons-check-circle"
              className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5"
            />
            <span>我们会尽快回复您的咨询，通常在工作日 24 小时内回复</span>
          </li>
          <li className="flex items-start">
            <Icon
              name="i-heroicons-check-circle"
              className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5"
            />
            <span>如遇到紧急问题，建议优先使用微信方式联系</span>
          </li>
          <li className="flex items-start">
            <Icon
              name="i-heroicons-check-circle"
              className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5"
            />
            <span>商务合作或其他重要事宜，请通过邮箱详细说明</span>
          </li>
        </ul>
      </div>
    </section>
  )
}
