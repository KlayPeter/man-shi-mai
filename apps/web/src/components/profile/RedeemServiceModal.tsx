'use client'

import React, { useState, useEffect } from 'react'
import Icon from '@/components/ui/Icon'
import { useUserStore } from '@/stores/userStore'
import { toast } from '@/stores/toastStore'
import request from '@/lib/request'

const REDEEM_COST = 20

const services = [
  {
    id: 'resume',
    title: '面试押题',
    badge: '3-5分钟',
    description: '根据岗位JD和简历，精准预测高频面试题，命中率80%+',
    points: ['AI精准分析岗位要求', '生成专属题库', '覆盖技术+行为题'],
    icon: 'i-heroicons-document-text',
    bgClass: 'bg-blue-50', iconClass: 'text-blue-600',
    activeBgClass: 'bg-blue-100', activeIconClass: 'text-blue-700',
    badgeClass: 'bg-blue-100 text-blue-700'
  },
  {
    id: 'special',
    title: '专项面试模拟',
    badge: '约1小时',
    description: '1v1 AI面试官深度模拟，支持语音/文字多模态作答',
    points: ['真实面试场景模拟', '多轮追问与反问', '结构化评分报告'],
    icon: 'i-heroicons-bolt',
    bgClass: 'bg-emerald-50', iconClass: 'text-emerald-600',
    activeBgClass: 'bg-emerald-100', activeIconClass: 'text-emerald-700',
    badgeClass: 'bg-emerald-100 text-emerald-700'
  },
  {
    id: 'behavior',
    title: '行测+HR面试',
    badge: '约45分钟',
    description: '综合素质评估，覆盖行测逻辑与HR软技能双维度',
    points: ['行测逻辑题训练', 'HR软技能评估', '综合能力报告'],
    icon: 'i-heroicons-user-group',
    bgClass: 'bg-purple-50', iconClass: 'text-purple-600',
    activeBgClass: 'bg-purple-100', activeIconClass: 'text-purple-700',
    badgeClass: 'bg-purple-100 text-purple-700'
  }
]

interface Props {
  open: boolean
  onClose: () => void
  onRedeemSuccess: (serviceType: string) => void
  onGoToRecharge: () => void
}

export default function RedeemServiceModal({ open, onClose, onRedeemSuccess, onGoToRecharge }: Props) {
  const userStore = useUserStore()
  const [selectedService, setSelectedService] = useState<string | null>(null)
  const [isRedeeming, setIsRedeeming] = useState(false)

  const balance = userStore.userInfo?.maiCoinBalance || 0
  const canRedeem = balance >= REDEEM_COST
  const redeemableCount = Math.floor(balance / REDEEM_COST)

  useEffect(() => {
    if (open) { setSelectedService(null); setIsRedeeming(false) }
  }, [open])

  const handleRedeem = async () => {
    if (!selectedService || !canRedeem) return
    setIsRedeeming(true)
    try {
      const data: any = await request.post('/interview/exchange-package', { packageType: selectedService })
      if (data?.remainingMaiCoin !== undefined) {
        userStore.updateUserInfo({ maiCoinBalance: data.remainingMaiCoin })
      }
      toast({ title: '兑换成功', description: `已兑换 ${services.find(s => s.id === selectedService)?.title || selectedService}`, color: 'green' })
      const svc = services.find(s => s.id === selectedService)
      onRedeemSuccess(svc?.title || selectedService)
      onClose()
    } catch (e: any) {
      toast({ title: '兑换失败', description: e.message || '请稍后重试', color: 'red' })
    } finally {
      setIsRedeeming(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-lg">
              <Icon name="i-heroicons-sparkles" className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">小麦币兑换服务</h3>
              <p className="text-xs text-gray-500">使用小麦币兑换面试服务权益</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <Icon name="i-heroicons-x-mark" className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* 余额展示 */}
          <div className="relative overflow-hidden rounded-2xl p-6 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 opacity-10 pointer-events-none">
              <Icon name="i-heroicons-sparkles" className="w-full h-full" />
            </div>
            <div className="relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white/80 mb-2">当前小麦币余额</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-bold">{balance}</span>
                    <span className="text-lg text-white/80">小麦币</span>
                  </div>
                </div>
                <div className="text-right bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/20">
                  <p className="text-xs text-white/80 mb-1">可兑换次数</p>
                  <p className="text-2xl font-bold">{redeemableCount}</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20 flex items-center gap-2 text-sm text-white/90">
                <Icon name="i-heroicons-information-circle" className="w-4 h-4" />
                <span>{REDEEM_COST} 小麦币可兑换任意服务一次</span>
              </div>
            </div>
          </div>

          {/* 服务选择 */}
          <div>
            <div className="mb-4">
              <h4 className="text-sm font-semibold text-gray-900 mb-1">选择要兑换的服务</h4>
              <p className="text-xs text-gray-500">选择一项服务进行兑换，兑换成功后立即生效</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {services.map(service => {
                const isSelected = selectedService === service.id
                return (
                  <div
                    key={service.id}
                    className={`group relative bg-white rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${isSelected ? 'border-primary-500 shadow-lg shadow-primary-500/20 scale-[1.02]' : 'border-gray-200 hover:border-primary-300 hover:shadow-md'}`}
                    onClick={() => setSelectedService(service.id)}
                  >
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-primary-500 flex items-center justify-center z-10">
                        <Icon name="i-heroicons-check" className="w-4 h-4 text-white" />
                      </div>
                    )}
                    <div className="absolute top-0 right-0 w-32 h-32 opacity-5 transition-opacity group-hover:opacity-10 pointer-events-none">
                      <Icon name={service.icon} className="w-full h-full" />
                    </div>
                    <div className="relative p-5 space-y-4">
                      <div className="flex items-start gap-3">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${isSelected ? service.activeBgClass : service.bgClass}`}>
                          <Icon name={service.icon} className={`w-6 h-6 transition-colors ${isSelected ? service.activeIconClass : service.iconClass}`} />
                        </div>
                        <div className="flex-1">
                          <h5 className="font-bold text-gray-900 mb-1">{service.title}</h5>
                          <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full ${service.badgeClass}`}>
                            {service.badge}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">{service.description}</p>
                      <ul className="space-y-2">
                        {service.points.map((point, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                            <Icon name="i-heroicons-check-circle" className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">兑换成本</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-xl font-bold text-amber-600">{REDEEM_COST}</span>
                          <span className="text-xs text-gray-500">小麦币</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 余额不足提示 */}
          {!canRedeem && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3">
              <Icon name="i-heroicons-exclamation-circle" className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-900 mb-1">余额不足</p>
                <p className="text-xs text-red-700">您的小麦币余额不足，无法兑换服务。请先充值小麦币。</p>
              </div>
              <button
                onClick={() => { onClose(); onGoToRecharge() }}
                className="px-3 py-1.5 rounded-lg bg-red-100 text-red-700 text-xs font-medium hover:bg-red-200 transition-colors"
              >
                去充值
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">兑换后服务立即生效，可在个人中心查看剩余次数</p>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm">
              取消
            </button>
            <button
              onClick={handleRedeem}
              disabled={!selectedService || !canRedeem || isRedeeming}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1.5"
            >
              <Icon name="i-heroicons-sparkles" className="w-4 h-4" />
              {isRedeeming ? '兑换中...' : '确认兑换'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
