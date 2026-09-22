import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/request', () => ({ default: {} }))
import { historyDestination, historyLabels, parseHistoryPage } from '@/api/interview-history'
const row = { resultId: 'record-1', position: '前端', status: 'completed', reportStatus: 'pending' }
describe('练习记录契约', () => {
  it('兼容旧服务端完整数组，并在本地按页裁切', () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({ ...row, resultId: String(i) }))
    expect(parseHistoryPage(rows, 'special', 3, 10)).toMatchObject({ total: 23, list: [{ resultId: '20' }, { resultId: '21' }, { resultId: '22' }] })
  })
  it('分页响应保留总数，空页不是没有任何历史', () => {
    expect(parseHistoryPage({ list: [], total: 23 }, 'special', 5, 10)).toEqual({ list: [], total: 23 })
    expect(parseHistoryPage({ list: [], total: 0 }, 'resume', 1, 10).total).toBe(0)
    expect(() => parseHistoryPage({ list: [], total: -1 }, 'special', 1, 10)).toThrow()
    expect(() => parseHistoryPage({}, 'special', 1, 10)).toThrow()
  })
  it('完成、暂停、中止与未知分别呈现，不冒充处理中', () => {
    for (const status of ['completed', 'paused', 'abandoned', 'in_progress'] as const) {
      const item = parseHistoryPage([{ ...row, status }], 'special', 1, 10).list[0]
      expect(item.status).toBe(status)
      expect(historyLabels[item.status].label).not.toBe('处理中')
    }
    expect(parseHistoryPage([{ ...row, status: 'unexpected' }], 'special', 1, 10).list[0].status).toBe('unknown')
    expect(parseHistoryPage([{ resultId: 'quiz' }], 'resume', 1, 10).list[0].status).toBe('completed')
  })
  it('模拟面试进入复盘与原问答，押题继续进入押题历史', () => {
    const item = parseHistoryPage([row], 'special', 1, 10).list[0]
    expect(historyDestination(item, 'special')).toBe('/interview/report?serviceType=special&resultId=record-1')
    expect(historyDestination(item, 'resume')).toBe('/interview?serviceType=resume&resultId=record-1&history=true')
    expect(() => parseHistoryPage([{ position: 'no id' }], 'special', 1, 10)).toThrow()
  })
})

it('保留开场恢复状态，旧记录无新字段仍可读', () => {
  for (const startStatus of ['prepared', 'refunding', 'ready', 'cancelled']) {
    expect(parseHistoryPage([{ ...row, startStatus }], 'special', 1, 10).list[0].startStatus).toBe(startStatus)
  }
  expect(parseHistoryPage([row], 'special', 1, 10).list[0].startStatus).toBeUndefined()
})
