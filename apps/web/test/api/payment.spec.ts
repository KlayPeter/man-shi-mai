import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/request', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
import request from '@/lib/request'
import { parsePaymentCapabilities, parsePaymentConfirmation, createOrderAPI, mockPaymentSuccessAPI } from '@/api/payment'

const capabilities = { enabled: true, mode: 'virtual', message: '测试不扣款', plans: [{ id: 'single', name: '单次练习', price: 18.8, benefits: { specialRemainingCount: 1 } }] }
describe('充值接口契约', () => {
  it('展示服务端实际权益，不另外推算赠送币数', () => {
    expect(parsePaymentCapabilities(capabilities).plans[0].benefits).toEqual({ specialRemainingCount: 1 })
  })
  it('拒绝不一致的开关、无效权益和未知字段', () => {
    expect(() => parsePaymentCapabilities({ ...capabilities, enabled: false })).toThrow()
    expect(() => parsePaymentCapabilities({ ...capabilities, plans: [{ ...capabilities.plans[0], benefits: { specialRemainingCount: -1 } }] })).toThrow()
    expect(() => parsePaymentCapabilities({ ...capabilities, plans: [{ ...capabilities.plans[0], benefits: { unlimited: true } }] })).toThrow()
  })
  it('处理中不是成功；成功但无权益也不能在本地加币', () => {
    expect(parsePaymentConfirmation({ orderId: 'test', status: 'processing', success: false }).success).toBe(false)
    expect(() => parsePaymentConfirmation({ orderId: 'test', status: 'success', success: true })).toThrow()
    expect(() => parsePaymentConfirmation({ orderId: 'test', status: 'pending', success: true })).toThrow()
  })
  it('成功响应只提取权益，丢弃任何多余用户字段', () => {
    const value = parsePaymentConfirmation({ orderId: 'test', status: 'success', success: true, user: { maiCoinBalance: 0, resumeRemainingCount: 0, specialRemainingCount: 1, behaviorRemainingCount: 0, hasUsedVirtualPayment: true, password: 'must-not-store' } })
    expect(value.user).not.toHaveProperty('password')
    expect(value.user?.specialRemainingCount).toBe(1)
  })
  it('使用真实的 order 路由与 virtual 通道，拒绝串单响应', async () => {
    vi.mocked(request.post).mockResolvedValueOnce({ orderId: '00000000-0000-4000-8000-000000000001', channel: 'virtual' })
    await createOrderAPI(capabilities.plans[0])
    expect(request.post).toHaveBeenCalledWith('/payment/order', expect.objectContaining({ channel: 'virtual', amount: 18.8 }))
    vi.mocked(request.post).mockResolvedValueOnce({ orderId: 'another-order', status: 'pending', success: false })
    await expect(mockPaymentSuccessAPI('original-order')).rejects.toThrow('订单响应不匹配')
  })
})
