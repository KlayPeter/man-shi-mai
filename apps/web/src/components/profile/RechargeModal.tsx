'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { useUserStore } from '@/stores/userStore'
import { toast } from '@/stores/toastStore'
import request from '@/lib/request'

const REDEEM_COST = 20

const rechargePlans = [
  { id: 'single', name: '入门包', badge: '', tagline: '适合初次体验', price: 18.8, coins: 30, originalPrice: 25, saving: 6.2, perks: [{ count: 1, label: '面试押题' }] },
  { id: 'pro', name: '进阶包', badge: '推荐', tagline: '最受欢迎的选择', price: 28.8, coins: 100, originalPrice: 50, saving: 21.2, perks: [{ count: 3, label: '面试押题' }, { count: 2, label: '专项面试' }] },
  { id: 'max', name: '精英包', badge: '超值', tagline: '全面提升面试竞争力', price: 68.8, coins: 220, originalPrice: 110, saving: 41.2, perks: [{ count: 5, label: '面试押题' }, { count: 4, label: '专项面试' }, { count: 2, label: '行测+HR' }] },
  { id: 'ultra', name: '无限包', badge: '最优惠', tagline: '长期备战首选', price: 128.8, coins: 400, originalPrice: 200, saving: 71.2, perks: [{ count: 10, label: '面试押题' }, { count: 8, label: '专项面试' }, { count: 4, label: '行测+HR' }] }
]

const serviceHighlights = [
  { title: '面试押题', description: '3-5分钟生成，命中率80%+', icon: 'i-heroicons-document-text' },
  { title: '专项面试模拟', description: '1v1 AI面试官，约1小时', icon: 'i-heroicons-bolt' },
  { title: '行测+HR面试', description: '综合素质评估，约45分钟', icon: 'i-heroicons-user-group' }
]

const CUSTOM_RECHARGE_ID = 'custom'

interface Props {
  open: boolean
  onClose: () => void
  onRecharged?: () => void
}

export default function RechargeModal({ open, onClose, onRecharged }: Props) {
  const userStore = useUserStore()
  const [selectedPlanId, setSelectedPlanId] = useState('pro')
  const [customAmount, setCustomAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const balance = userStore.userInfo?.maiCoinBalance ?? 0
  const redeemableCount = Math.floor(balance / REDEEM_COST)
  const hasUsedMockPayment = (userStore.userInfo as any)?.hasUsedVirtualPayment ?? false

  const selectedPlan = rechargePlans.find(p => p.id === selectedPlanId) || {
    id: CUSTOM_RECHARGE_ID,
    name: '自定义充值',
    description: '自定义充值',
    price: Number(customAmount) || 0,
    coins: Number(customAmount) || 0,
    originalPrice: Number(customAmount) || 0,
    saving: 0,
    perks: []
  }

  useEffect(() => {
    if (open) {
      setSelectedPlanId('pro')
      setLoading(false)
      setPaymentSuccess(false)
      setCustomAmount('')
    }
  }, [open])

  const handleCustomRecharge = () => {
    const amount = Number(customAmount)
    if (!amount || amount < 1 || amount > 10000) {
      toast({ title: '请输入 1-10000 的小麦币数量', color: 'yellow' })
      return
    }
    setSelectedPlanId(CUSTOM_RECHARGE_ID)
  }

  const handleMockPayment = async () => {
    if (hasUsedMockPayment) {
      toast({ title: '模拟支付已使用', description: '每个用户仅限使用一次模拟支付', color: 'yellow' })
      return
    }
    setLoading(true)
    await new Promise(r => setTimeout(r, 1500))
    try {
      const orderData: any = await request.post('/payment/order', {
        planId: selectedPlan.id,
        planName: selectedPlan.name,
        amount: selectedPlan.price,
        source: 'web',
        description: `购买${selectedPlan.name}`,
        channel: 'alipay'
      })
      const mockData: any = await request.post('/payment/mock-success', { orderId: orderData?.orderId })
      if (mockData?.user) userStore.updateUserInfo(mockData.user)
      setPaymentSuccess(true)
      toast({ title: '充值成功', description: `已到账 ${selectedPlan.coins} 小麦币`, color: 'green' })
      onRecharged?.()
      setTimeout(() => onClose(), 2000)
    } catch (e: any) {
      const errorMsg = e?.response?.data?.message || e?.message || '请稍后重试'
      if (errorMsg.includes('已使用') || errorMsg.includes('仅限') || e?.response?.status === 403) {
        userStore.updateUserInfo({ hasUsedVirtualPayment: true })
        toast({ title: '模拟支付已使用', description: '每个用户仅限使用一次模拟支付', color: 'yellow' })
      } else {
        toast({ title: '支付失败', description: errorMsg, color: 'red' })
      }
    } finally {
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[1400px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="font-semibold text-gray-900">充值享优惠</span>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <Icon name="i-heroicons-x-mark" className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* 余额 + 自定义充值 */}
          <div className="flex justify-between bg-gradient-to-r from-primary-500/10 via-primary-500/5 to-primary-500/10 rounded-2xl p-5 border border-primary-100">
            <div>
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-sm text-gray-600 mr-2">当前余额</span>
                  <span className="text-2xl font-bold text-primary-600">{balance.toFixed(2)} 小麦币</span>
                  <p className="text-xs text-gray-500 mt-1">
                    充值成功后即时到账，
                    <span className="text-primary-600 font-bold text-sm">{REDEEM_COST} </span>
                    小麦币可兑换一次 {serviceHighlights[0].title} / {serviceHighlights[1].title} / {serviceHighlights[2].title}
                    <span className="text-gray-500 text-xs ml-4">
                      目前可兑换 <span className="text-primary-600 font-bold text-sm">{redeemableCount}</span> 次
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-[280px] shrink-0">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">购买</span>
                  <input
                    type="number" min="1" max="10000"
                    value={customAmount}
                    onChange={e => setCustomAmount(e.target.value)}
                    placeholder="输入 1 - 10000 的整数"
                    className="w-full pl-10 pr-16 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">小麦币</span>
                </div>
                <button
                  onClick={handleCustomRecharge}
                  className="px-3 py-2 rounded-lg border border-amber-400 text-amber-600 text-xs font-medium hover:bg-amber-50 transition-colors"
                >
                  确定
                </button>
              </div>
              <p className="text-[11px] text-gray-500">
                小麦币可用于兑换 {serviceHighlights[0].title} / {serviceHighlights[1].title} / {serviceHighlights[2].title} 等服务
              </p>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            {/* 左侧：套餐列表 */}
            <div className="flex-1 space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">购买套餐 / 小麦币</p>
                    <p className="text-xs text-gray-500">一次支付，解锁更多权益</p>
                  </div>
                  <p className="text-xs text-gray-400">套餐权益实时生效</p>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {rechargePlans.map(plan => {
                    const isSelected = selectedPlanId === plan.id
                    return (
                      <button
                        key={plan.id}
                        type="button"
                        className={`min-w-[208px] shrink-0 rounded-2xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 ${isSelected ? 'border-primary-500 bg-primary-50/80 shadow-lg' : 'border-transparent bg-white shadow'}`}
                        onClick={() => setSelectedPlanId(plan.id)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <p className="text-base font-semibold text-gray-900">{plan.name}</p>
                            {plan.badge && (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary-100 text-primary-600 font-medium">{plan.badge}</span>
                            )}
                          </div>
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-primary-500 bg-primary-500' : 'border-gray-300'}`}>
                            {isSelected && <Icon name="i-heroicons-check" className="w-3 h-3 text-white" />}
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">{plan.tagline}</p>
                        {plan.perks?.length > 0 && (
                          <ul className="space-y-1 text-sm text-gray-700 mb-3">
                            {plan.perks.map(perk => (
                              <li key={perk.label} className="flex items-center gap-1.5">
                                <Icon name="i-heroicons-check-circle" className="w-4 h-4 text-primary-500" />
                                <span>{perk.count} 次 {perk.label}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="flex flex-col items-start text-xs mb-3">
                          <span className="text-amber-600 font-medium">原价 {plan.originalPrice} 元 · 立省 {plan.saving.toFixed(1)} 元</span>
                          <span className="text-gray-500 mt-1">支付之后，套餐永久有效</span>
                        </div>
                        <div>
                          <p className="text-3xl font-bold text-gray-900">¥{plan.price}</p>
                          <p className="text-xs text-gray-500">≈ {plan.coins} 小麦币</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-600">
                {serviceHighlights.map(service => (
                  <div key={service.title} className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 flex gap-3 items-start">
                    <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-inner shrink-0">
                      <Icon name={service.icon} className="w-4 h-4 text-primary-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 mb-0.5">{service.title}</p>
                      <p className="text-[11px] leading-relaxed">{service.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：支付摘要 */}
            <div className="w-full lg:w-72 shrink-0 rounded-2xl border border-gray-100 bg-white shadow-sm p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">模拟支付</span>
                <span className="text-[11px] text-gray-400">测试环境</span>
              </div>

              <div className="text-center py-2 border rounded-2xl bg-gray-50/70">
                <p className="text-xs text-gray-500">模拟支付</p>
                <p className="text-3xl font-bold text-primary-600 mt-1">¥{selectedPlan?.price || '--'}</p>
                {selectedPlan?.saving > 0 && (
                  <p className="text-xs text-amber-600 font-medium mt-1">限时立省 {selectedPlan.saving.toFixed(1)} 元</p>
                )}
              </div>

              <div className="h-[188px] rounded-xl border border-dashed border-gray-300 bg-white text-center text-xs text-gray-400 relative overflow-hidden">
                {paymentSuccess ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-emerald-50 text-emerald-700">
                    <Icon name="i-heroicons-check-circle" className="w-10 h-10 text-emerald-500" />
                    <p className="text-base font-semibold">支付成功</p>
                    <p className="text-xs">权益已更新，可立即使用</p>
                  </div>
                ) : hasUsedMockPayment ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Icon name="i-heroicons-x-circle" className="w-20 h-20 text-gray-300" />
                    </div>
                    <p className="text-sm text-gray-500">模拟支付已使用</p>
                    <p className="text-xs text-gray-400">每个用户仅限一次免费体验</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center">
                      <Icon name="i-heroicons-qr-code" className="w-20 h-20 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600">模拟支付二维码</p>
                    <button
                      onClick={handleMockPayment}
                      disabled={loading}
                      className="px-4 py-1.5 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700 disabled:opacity-60 transition-colors"
                    >
                      {loading ? '处理中...' : '点击模拟支付成功'}
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-gray-400 text-center">
                支付即视为同意相关
                <Link href="/agreement" target="_blank" className="text-primary-600 hover:underline">服务协议</Link>
                与
                <Link href="/policy" target="_blank" className="text-primary-600 hover:underline">隐私政策</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
