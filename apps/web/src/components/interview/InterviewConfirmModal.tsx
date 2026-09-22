'use client'

import React from 'react'
import Icon from '@/components/ui/Icon'
import { useInterviewStore } from '@/stores/interviewStore'

interface InterviewConfirmModalProps {
  serviceType: 'resume' | 'special' | 'behavior'
  remainingCount: number
  onConfirm: () => void
  onClose: () => void
}

export default function InterviewConfirmModal({
  serviceType,
  remainingCount,
  onConfirm,
  onClose
}: InterviewConfirmModalProps) {
  const interviewStore = useInterviewStore()

  const serviceConfig = {
    resume: {
      borderColor: 'border-blue-200',
      iconColor: 'text-blue-500',
      buttonText: '开始押题',
      infoItems: [
        {
          icon: 'i-heroicons-document-text',
          text: '本次服务将<span class="text-blue-600 font-semibold">基于岗位 JD 生成押题清单</span>，附带示范答案与提醒。'
        },
        {
          icon: 'i-heroicons-clock',
          text: '预计生成时长：<span class="text-blue-600 font-semibold"> 5 - 7 分钟</span>。'
        },
        {
          icon: 'i-heroicons-credit-card',
          text: `确认后将<strong class="text-blue-600">扣除 1 次简历押题</strong>余额（当前剩余 ${remainingCount} 次）。`
        }
      ]
    },
    special: {
      borderColor: 'border-primary-200',
      iconColor: 'text-primary-500',
      buttonText: '开始 专项面试',
      infoItems: [
        {
          icon: 'i-heroicons-bolt',
          text: '本次服务将进行<span class="text-primary-600 font-semibold">专项技能面试模拟</span>，包含 AI 即时反馈与追问。'
        },
        {
          icon: 'i-heroicons-clock',
          text: '本次专项面试<span class="text-primary-600 font-semibold">时长约 60 ～ 90 分钟</span>，包含提问与反馈环节。'
        },
        {
          icon: 'i-heroicons-credit-card',
          text: `确认后将<strong class="text-primary-600">扣除 1 次专项面试</strong>余额（当前剩余 ${remainingCount} 次）。`
        }
      ]
    },
    behavior: {
      borderColor: 'border-purple-200',
      iconColor: 'text-purple-500',
      buttonText: '开始 行测 + HR 面试',
      infoItems: [
        {
          icon: 'i-heroicons-chat-bubble-left-right',
          text: '本次服务包含<span class="text-purple-600 font-semibold">行测题库与 HR 面试模拟</span>，全面评估软技能。'
        },
        {
          icon: 'i-heroicons-clock',
          text: '本次综合面试<span class="text-purple-600 font-semibold">时长约 45 ～ 70 分钟</span>，包含行测与 HR 问答。'
        },
        {
          icon: 'i-heroicons-credit-card',
          text: `确认后将<strong class="text-purple-600">扣除 1 次综合面试</strong>余额（当前剩余 ${remainingCount} 次）。`
        }
      ]
    }
  }

  const cfg = serviceConfig[serviceType]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">
          {serviceType === 'resume' ? '准备开始简历押题' : serviceType === 'special' ? '准备开始专项面试' : '准备开始行测 + HR 面试'}
        </h3>
        <p className="text-sm text-neutral-500 mb-6">请确认以下信息后再开始服务流程</p>

        <div className="space-y-5">
          {/* 基本信息卡片 */}
          <div className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4">
            <div className="space-y-3">
              <div>
                <p className="text-sm text-neutral-500 mb-1">目标岗位</p>
                <p className="text-base font-semibold text-neutral-900">
                  {interviewStore.selectedPosition?.positionName || '未设置'}
                </p>
              </div>
              <div>
                <label className="text-sm text-neutral-500 mb-1 block">目标公司（选填）</label>
                <input
                  value={interviewStore.selectedPosition?.company || ''}
                  onChange={e => interviewStore.setSelectedPosition({ ...interviewStore.selectedPosition, company: e.target.value })}
                  placeholder="请输入公司名称，例如：字节跳动"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* 服务详情卡片 */}
          <div className={`rounded-2xl border border-dashed p-4 ${cfg.borderColor}`}>
            <ul className="space-y-3 text-sm text-neutral-600">
              {cfg.infoItems.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Icon name={item.icon} className={`w-4 h-4 mt-0.5 ${cfg.iconColor}`} />
                  <span dangerouslySetInnerHTML={{ __html: item.text }} />
                </li>
              ))}
            </ul>
          </div>

          {/* 确认按钮 */}
          {remainingCount > 0 ? (
            <button
              onClick={onConfirm}
              className="w-full py-3 bg-primary-600 text-white rounded-lg text-base font-semibold hover:bg-primary-700 transition-colors"
            >
              {cfg.buttonText}
            </button>
          ) : (
            <>
              <button
                onClick={() => window.location.href = '/profile'}
                className="w-full py-3 bg-primary-600 text-white rounded-lg text-base font-semibold hover:bg-primary-700 transition-colors"
              >
                去充值
              </button>
              <div className="text-center text-sm text-amber-600 bg-amber-50 rounded-lg p-3 border border-amber-200">
                <Icon name="i-heroicons-exclamation-triangle" className="w-4 h-4 inline" />
                {' '}余额不足，请先充值
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
