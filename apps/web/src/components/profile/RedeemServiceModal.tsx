'use client'

import React, { useState, useEffect, useRef } from 'react'
import Icon from '@/components/ui/Icon'
import { useUserStore } from '@/stores/userStore'
import { toast } from '@/stores/toastStore'
import request from '@/lib/request'

const REDEEM_COST = 20
type ServiceId = 'resume' | 'special' | 'behavior'
type PendingExchange = { requestId: string; packageType: ServiceId }
const exchangeKey = (userId: string) => `pending-mai-exchange:${userId}`
const isServiceId = (value: unknown): value is ServiceId => value === 'resume' || value === 'special' || value === 'behavior'
const readPendingExchange = (userId: string): PendingExchange | null => {
  try {
    const raw = localStorage.getItem(exchangeKey(userId))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (value && typeof value === 'object' && 'requestId' in value && 'packageType' in value &&
      typeof value.requestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.requestId) && isServiceId(value.packageType)) return value as PendingExchange
  } catch { /* A broken local record must not create another debit automatically. */ }
  return null
}

const services: { id: ServiceId; title: string; badge: string; description: string; points: string[]; icon: string; bgClass: string; iconClass: string; activeBgClass: string; activeIconClass: string; badgeClass: string }[] = [
  {
    id: 'resume',
    title: '面试押题',
    badge: '岗位分析',
    description: '结合岗位要求与经历生成练习题，不承诺真实面试命中率。',
    points: ['分析岗位要求', '生成练习题', '查看回答思路'],
    icon: 'i-heroicons-document-text',
    bgClass: 'bg-blue-50', iconClass: 'text-blue-600',
    activeBgClass: 'bg-blue-100', activeIconClass: 'text-blue-700',
    badgeClass: 'bg-blue-100 text-blue-700'
  },
  {
    id: 'special',
    title: '专项面试模拟',
    badge: '15–45 分钟',
    description: '1v1 专业能力模拟，支持语音或文字回答。',
    points: ['自选练习强度', '多轮追问', '逐题复盘'],
    icon: 'i-heroicons-bolt',
    bgClass: 'bg-emerald-50', iconClass: 'text-emerald-600',
    activeBgClass: 'bg-emerald-100', activeIconClass: 'text-emerald-700',
    badgeClass: 'bg-emerald-100 text-emerald-700'
  },
  {
    id: 'behavior',
    title: '行测+HR面试',
    badge: '15–45 分钟',
    description: '练习协作、判断和表达，支持语音或文字回答。',
    points: ['自选练习强度', '行为问题追问', '逐题复盘'],
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
  const [selectedService, setSelectedService] = useState<ServiceId | null>(null)
  const [isRedeeming, setIsRedeeming] = useState(false)
  const [pending, setPending] = useState<PendingExchange | null>(null)
  const [exchangeError, setExchangeError] = useState('')
  const redeemingRef = useRef(false)
  const userId = userStore.userInfo?._id || ''

  const balance = userStore.userInfo?.maiCoinBalance || 0
  const canRedeem = balance >= REDEEM_COST
  const redeemableCount = Math.floor(balance / REDEEM_COST)

  useEffect(() => {
    if (open && userId) {
      const saved = readPendingExchange(userId)
      setPending(saved)
      setSelectedService(saved?.packageType || null)
      setExchangeError('')
    }
  }, [open, userId])

  const handleRedeem = async () => {
    if (redeemingRef.current || !selectedService || (!canRedeem && !pending)) return
    if (!userId) { setExchangeError('账户信息未加载，请稍后重试'); return }
    const command = pending || { requestId: crypto.randomUUID(), packageType: selectedService }
    try {
      localStorage.setItem(exchangeKey(userId), JSON.stringify(command))
    } catch {
      setExchangeError('无法保存本次兑换请求，请检查浏览器存储后重试')
      return
    }
    setPending(command)
    redeemingRef.current = true
    setIsRedeeming(true)
    setExchangeError('')
    try {
      const data: unknown = await request.post('/interview/exchange-package', command)
      if (!data || typeof data !== 'object' || !('requestId' in data) || data.requestId !== command.requestId ||
        !('packageType' in data) || data.packageType !== command.packageType || !('success' in data) || data.success !== true ||
        !('remainingMaiCoin' in data) || typeof data.remainingMaiCoin !== 'number' || !Number.isFinite(data.remainingMaiCoin) ||
        !('remainingCount' in data) || !Number.isInteger(data.remainingCount)) throw new Error('兑换结果未确认，请使用同一请求重试')
      const countKey = command.packageType === 'resume' ? 'resumeRemainingCount' : command.packageType === 'special' ? 'specialRemainingCount' : 'behaviorRemainingCount'
      userStore.updateUserInfo({ maiCoinBalance: data.remainingMaiCoin, [countKey]: data.remainingCount as number })
      localStorage.removeItem(exchangeKey(userId))
      setPending(null)
      toast({ title: '兑换成功', description: `已兑换 ${services.find(s => s.id === command.packageType)?.title || command.packageType}`, color: 'green' })
      const svc = services.find(s => s.id === command.packageType)
      onRedeemSuccess(svc?.title || command.packageType)
      onClose()
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '结果未确认，请重试同一次兑换'
      setExchangeError(message)
      toast({ title: '兑换结果未确认', description: message, color: 'red' })
    } finally {
      setIsRedeeming(false)
      redeemingRef.current = false
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { if (!isRedeeming) onClose() }}>
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
          <button onClick={onClose} disabled={isRedeeming} aria-label="关闭兑换" className="p-1 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50">
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
                    role="button"
                    tabIndex={pending ? -1 : 0}
                    aria-pressed={isSelected}
                    aria-disabled={!!pending}
                    aria-label={`兑换${service.title}`}
                    className={`group relative bg-white rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden ${isSelected ? 'border-primary-500 shadow-lg shadow-primary-500/20 scale-[1.02]' : 'border-gray-200 hover:border-primary-300 hover:shadow-md'}`}
                    onClick={() => { if (!pending) setSelectedService(service.id) }}
                    onKeyDown={event => { if (!pending && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); setSelectedService(service.id) } }}
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
          {pending && <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">上次兑换尚未确认。请重试这次{services.find(service => service.id === pending.packageType)?.title}兑换；重复请求不会再次扣币。</p>}
          {exchangeError && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{exchangeError}</p>}
          {!canRedeem && !pending && (
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
            <button onClick={onClose} disabled={isRedeeming} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm disabled:opacity-50">
              取消
            </button>
            <button
              onClick={handleRedeem}
              disabled={!selectedService || (!canRedeem && !pending) || isRedeeming}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center gap-1.5"
            >
              <Icon name="i-heroicons-sparkles" className="w-4 h-4" />
              {isRedeeming ? '兑换中...' : pending ? '重试本次兑换' : '确认兑换'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
