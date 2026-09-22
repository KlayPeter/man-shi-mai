import request from '@/lib/request'

export const benefitLabels = {
  maiCoinBalance: '小麦币',
  resumeRemainingCount: '面试押题',
  specialRemainingCount: '专项面试',
  behaviorRemainingCount: '行为 / HR 面试'
} as const
export type BenefitField = keyof typeof benefitLabels
export interface PaymentPlan { id: string; name: string; price: number; benefits: Partial<Record<BenefitField, number>> }
export interface PaymentCapabilities { enabled: boolean; mode: 'virtual' | 'disabled'; message: string; plans: PaymentPlan[] }
export interface PaymentConfirmation {
  orderId: string
  status: 'pending' | 'processing' | 'success' | 'failed'
  success: boolean
  user?: Partial<Record<BenefitField, number>> & { hasUsedVirtualPayment: boolean }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const fields = Object.keys(benefitLabels) as BenefitField[]
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
function parseBenefits(value: unknown): Partial<Record<BenefitField, number>> {
  if (!object(value) || Object.keys(value).some(key => !fields.includes(key as BenefitField))) throw new Error('套餐权益格式异常')
  const result: Partial<Record<BenefitField, number>> = {}
  for (const field of fields) {
    if (value[field] !== undefined) {
      if (!count(value[field])) throw new Error('套餐权益数量异常')
      result[field] = value[field]
    }
  }
  return result
}
export function parsePaymentCapabilities(value: unknown): PaymentCapabilities {
  if (!object(value) || typeof value.enabled !== 'boolean' || !['virtual', 'disabled'].includes(String(value.mode)) || typeof value.message !== 'string' || !Array.isArray(value.plans) || value.enabled !== (value.mode === 'virtual')) throw new Error('充值状态格式异常')
  const plans = value.plans.map((plan: unknown) => {
    if (!object(plan) || typeof plan.id !== 'string' || typeof plan.name !== 'string' || typeof plan.price !== 'number' || !Number.isFinite(plan.price) || plan.price <= 0) throw new Error('套餐格式异常')
    return { id: plan.id, name: plan.name, price: plan.price, benefits: parseBenefits(plan.benefits) }
  })
  return { enabled: value.enabled, mode: value.mode as PaymentCapabilities['mode'], message: value.message, plans }
}
export async function getPaymentCapabilitiesAPI(signal?: AbortSignal) {
  return parsePaymentCapabilities(await request.get<unknown, unknown>('/payment/capabilities', { signal }))
}
export async function createOrderAPI(plan: PaymentPlan) {
  const result = await request.post<unknown, unknown>('/payment/order', { planId: plan.id, planName: plan.name, amount: plan.price, channel: 'virtual', source: 'web', description: `测试模拟发放：${plan.name}` })
  if (!object(result) || typeof result.orderId !== 'string' || !/^[0-9a-f-]{36}$/i.test(result.orderId) || result.channel !== 'virtual') throw new Error('订单响应异常，请重新查询')
  return { orderId: result.orderId }
}
export function parsePaymentConfirmation(value: unknown): PaymentConfirmation {
  if (!object(value) || typeof value.orderId !== 'string' || !['pending', 'processing', 'success', 'failed'].includes(String(value.status)) || typeof value.success !== 'boolean' || value.success !== (value.status === 'success')) throw new Error('发放状态异常')
  const result: PaymentConfirmation = { orderId: value.orderId, status: value.status as PaymentConfirmation['status'], success: value.success }
  if (value.success) {
    if (!object(value.user) || typeof value.user.hasUsedVirtualPayment !== 'boolean') throw new Error('权益响应缺失，请重试查询')
    const benefits: Partial<Record<BenefitField, number>> = {}
    for (const field of fields) {
      if (!count(value.user[field])) throw new Error('权益响应格式异常')
      benefits[field] = value.user[field]
    }
    result.user = { ...benefits, hasUsedVirtualPayment: value.user.hasUsedVirtualPayment }
  }
  return result
}
export async function mockPaymentSuccessAPI(orderId: string) {
  const result = parsePaymentConfirmation(await request.post<unknown, unknown>('/payment/mock-success', { orderId }))
  if (result.orderId !== orderId) throw new Error('订单响应不匹配')
  return result
}
