'use client'

import React, { useState } from 'react'
import Icon from '@/components/ui/Icon'

export default function FeedbackButton() {
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async () => {
    if (!feedback.trim()) return

    // TODO: 实现反馈提交逻辑
    setSubmitted(true)
    setTimeout(() => {
      setShowFeedback(false)
      setSubmitted(false)
      setFeedback('')
    }, 2000)
  }

  return (
    <>
      <button
        onClick={() => setShowFeedback(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 bg-primary-500 text-white px-3 py-6 rounded-l-lg shadow-lg hover:bg-primary-600 transition-all z-40 writing-mode-vertical-rl"
        style={{ writingMode: 'vertical-rl' }}
      >
        <Icon name="i-heroicons-chat-bubble-left-right" className="w-5 h-5 inline-block mr-1" />
        意见反馈
      </button>

      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-neutral-900">意见反馈</h3>
              <button
                onClick={() => setShowFeedback(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icon name="i-heroicons-x-mark" className="w-6 h-6" />
              </button>
            </div>
            {submitted ? (
              <div className="text-center py-8">
                <Icon name="i-heroicons-check-circle" className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-lg font-medium text-neutral-900">感谢您的反馈！</p>
                <p className="text-sm text-neutral-500 mt-2">我们会认真考虑您的建议</p>
              </div>
            ) : (
              <>
                <textarea
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="请输入您的意见或建议..."
                  className="w-full h-32 p-3 border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => setShowFeedback(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!feedback.trim()}
                    className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    提交
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
