'use client'

import { useState, useEffect, useRef } from 'react'
import { isAxiosError } from 'axios'
import Icon from '@/components/ui/Icon'
import { useUserStore } from '@/stores/userStore'
import { benefitLabels, createOrderAPI, getPaymentCapabilitiesAPI, mockPaymentSuccessAPI, type PaymentCapabilities, type BenefitField } from '@/api/payment'

interface Props { open: boolean; onClose: () => void; onRecharged?: () => void }
interface PendingOrder { orderId: string; planId: string }
const focus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary-600'

function savedOrder(key: string): PendingOrder | null {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem(key) || 'null')
    if (value && typeof value === 'object' && 'orderId' in value && 'planId' in value && typeof value.orderId === 'string' && typeof value.planId === 'string') return { orderId: value.orderId, planId: value.planId }
  } catch { /* 本地存储不可用时仍可在本次打开期间恢复。 */ }
  return null
}
function saveOrder(key: string, order: PendingOrder | null) {
  try { if (order) sessionStorage.setItem(key, JSON.stringify(order)); else sessionStorage.removeItem(key) } catch { /* 不影响服务器确认和当前内存状态。 */ }
}

export default function RechargeModal({ open, onClose, onRecharged }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const submitting = useRef(false)
  const user = useUserStore(state => state.userInfo)
  const [capabilities, setCapabilities] = useState<PaymentCapabilities | null>(null)
  const [selectedId, setSelectedId] = useState('pro')
  const [pending, setPending] = useState<PendingOrder | null>(null)
  const [retry, setRetry] = useState(0)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const storageKey = `msm-virtual-order:${user._id}`

  useEffect(() => {
    const element = dialog.current
    if (open) element?.showModal()
    else element?.close()
    return () => element?.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    const stored = savedOrder(storageKey)
    setPending(stored)
    if (stored) setSelectedId(stored.planId)
    setSuccess(false)
    setError('')
    setCapabilities(null)
    getPaymentCapabilitiesAPI(controller.signal).then(value => {
      if (!controller.signal.aborted) setCapabilities(value)
    }).catch(() => {
      if (!controller.signal.aborted) setError('暂时无法读取充值状态，请重试。')
    })
    return () => controller.abort()
  }, [open, retry, storageKey])

  const selectedPlan = capabilities?.plans.find(plan => plan.id === selectedId)
  const submit = async () => {
    if (submitting.current || !selectedPlan || !user._id) return
    const accountId = user._id
    submitting.current = true
    setLoading(true)
    setError('')
    try {
      let order = pending
      if (!order) {
        const created = await createOrderAPI(selectedPlan)
        order = { orderId: created.orderId, planId: selectedPlan.id }
        setPending(order)
        saveOrder(storageKey, order)
      }
      if (useUserStore.getState().userInfo._id !== accountId) return
      const result = await mockPaymentSuccessAPI(order.orderId)
      if (useUserStore.getState().userInfo._id !== accountId) return
      if (!result.success || !result.user) {
        setError('订单正在处理，请稍后点击“继续确认”。同一订单不会重复发放。')
        return
      }
      useUserStore.getState().updateUserInfo(result.user)
      saveOrder(storageKey, null)
      setPending(null)
      setSuccess(true)
      onRecharged?.()
    } catch (cause: unknown) {
      if (isAxiosError(cause) && [400, 403, 404].includes(cause.response?.status ?? 0)) {
        saveOrder(storageKey, null)
        setPending(null)
        setError('此订单无法继续，请返回账户查看最新权益。每个账户限一次测试模拟发放。')
      } else {
        setError('发放尚未确认。请继续确认同一订单；已发放的权益不会重复增加。')
      }
    } finally {
      submitting.current = false
      setLoading(false)
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="recharge-title" onCancel={onClose} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-3xl border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-black/40">
      <div className="p-5 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="mb-2 text-xs tracking-widest text-muted">面试麦 · 账户权益</p><h2 id="recharge-title" className="text-2xl font-semibold">为下一场练习做准备</h2></div>
          <button type="button" aria-label="关闭充值窗口" onClick={onClose} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line ${focus}`}><Icon name="i-heroicons-x-mark" className="h-5 w-5" /></button>
        </div>
        <p className="mt-5 rounded-2xl bg-white p-4 text-sm">当前余额 <strong className="ml-2 text-xl">{user.maiCoinBalance ?? 0}</strong> 小麦币</p>
        {!capabilities && !error && <p role="status" className="py-8 text-muted">正在读取可用权益…</p>}
        {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}{!capabilities && <button type="button" onClick={() => setRetry(value => value + 1)} className={`ml-3 min-h-11 underline ${focus}`}>重新加载</button>}</div>}
        {capabilities && <>
          <p className="my-5 text-sm leading-6 text-muted">{capabilities.message}</p>
          {!capabilities.enabled ? <div className="rounded-2xl border border-line bg-white p-6"><h3 className="text-lg font-semibold">充值暂未开放</h3><p className="mt-2 text-sm text-muted">已有次数可以继续练习，也可在账户中使用小麦币兑换次数。</p><button type="button" onClick={onClose} className={`mt-6 min-h-11 rounded-full bg-primary-600 px-6 text-sm text-white ${focus}`}>返回账户</button></div> : <>
            <fieldset disabled={loading || !!pending || success || !!user.hasUsedVirtualPayment} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <legend className="mb-3 font-medium">选择测试套餐</legend>
              {capabilities.plans.map(plan => <label key={plan.id} className={`cursor-pointer rounded-2xl border p-5 ${selectedId === plan.id ? 'border-primary-600 bg-primary-50' : 'border-line bg-white'}`}>
                <span className="flex items-center justify-between gap-3"><span className="font-semibold">{plan.name}</span><input type="radio" name="payment-plan" value={plan.id} checked={selectedId === plan.id} onChange={() => setSelectedId(plan.id)} className={`h-5 w-5 accent-primary-600 ${focus}`} /></span>
                <span className="my-3 block text-sm text-muted">订单标价 ¥{plan.price} · 测试不扣款</span>
                <ul className="space-y-1 text-sm">{Object.entries(plan.benefits).map(([key, count]) => <li key={key}>{count} {key === 'maiCoinBalance' ? '枚' : '次'}{benefitLabels[key as BenefitField]}</li>)}</ul>
              </label>)}
            </fieldset>
            <div className="mt-6 border-t border-line pt-5">
              {success ? <p role="status" className="font-medium text-green-800">模拟权益已更新，可返回账户查看。未产生真实交易。</p> : <>
                {user.hasUsedVirtualPayment && !pending && <p className="mb-3 text-sm text-muted">此账户已使用过测试模拟发放。</p>}
                <button type="button" onClick={submit} disabled={loading || !selectedPlan || (!!user.hasUsedVirtualPayment && !pending)} className={`min-h-11 w-full rounded-full bg-primary-600 px-6 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto ${focus}`}>{loading ? '正在确认…' : pending ? '继续确认' : '确认模拟发放（不扣款）'}</button>
                {pending && <p className="mt-3 break-all text-xs text-muted">待确认订单：{pending.orderId}。关闭窗口或刷新后可继续。</p>}
              </>}
            </div>
          </>}
        </>}
      </div>
    </dialog>
  )
}
