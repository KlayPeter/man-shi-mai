import request from '@/lib/request'
import { isAxiosError } from 'axios'

export type HistoryType = 'resume' | 'special' | 'behavior'
export type HistoryStatus = 'completed' | 'in_progress' | 'paused' | 'abandoned' | 'unknown'
export type HistoryReportStatus = 'pending' | 'generating' | 'completed' | 'failed' | 'insufficient_data' | 'unknown'
export interface HistoryItem {
  resultId: string
  company: string
  position: string
  createdAt: string | null
  status: HistoryStatus
  startStatus?: 'prepared' | 'ready' | 'refunding' | 'cancelled'
  reportStatus: HistoryReportStatus
}
export interface HistoryPage { list: HistoryItem[]; total: number }
const paths: Record<HistoryType, string> = {
  resume: '/interview/resume/quiz/history', special: '/interview/special/history', behavior: '/interview/behavior/history'
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
export function parseHistoryPage(value: unknown, type: HistoryType, page: number, limit: number): HistoryPage {
  // Older servers return the complete array: slice locally during rolling deployment.
  const legacy = Array.isArray(value)
  const rows = legacy ? value : record(value) ? value.list ?? value.records : undefined
  const total = legacy ? value.length : record(value) ? value.total : undefined
  if (!Array.isArray(rows) || typeof total !== 'number' || !Number.isSafeInteger(total) || total < 0) throw new Error('练习记录格式异常')
  const list = (legacy ? rows.slice((page - 1) * limit, page * limit) : rows).map(item => {
    if (!record(item) || typeof item.resultId !== 'string' || !item.resultId) throw new Error('练习记录缺少编号')
    const status: HistoryStatus = type === 'resume' || item.status === 'success' ? 'completed'
      : ['completed', 'in_progress', 'paused', 'abandoned'].includes(String(item.status)) ? item.status as HistoryStatus : 'unknown'
    const reportStatus: HistoryReportStatus = ['pending', 'generating', 'completed', 'failed', 'insufficient_data'].includes(String(item.reportStatus))
      ? item.reportStatus as HistoryReportStatus : 'unknown'
    return { resultId: item.resultId, company: typeof item.company === 'string' ? item.company : '', position: typeof item.position === 'string' ? item.position : '',
      ...(['prepared', 'ready', 'refunding', 'cancelled'].includes(String(item.startStatus)) ? { startStatus: item.startStatus as HistoryItem['startStatus'] } : {}),
      createdAt: typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) ? item.createdAt : null, status, reportStatus }
  })
  return { list, total }
}
export async function getHistoryPage(type: HistoryType, page: number, limit: number, signal?: AbortSignal) {
  return parseHistoryPage(await request.get<unknown, unknown>(paths[type], { params: { page, limit }, signal }), type, page, limit)
}
export function historyDestination(item: HistoryItem, type: HistoryType) {
  const query = new URLSearchParams({ serviceType: type, resultId: item.resultId })
  if (type === 'resume') { query.set('history', 'true'); return `/interview?${query}` }
  return `/interview/report?${query}`
}
export const historyLabels: Record<HistoryStatus, { label: string; icon: string }> = {
  completed: { label: '已结束', icon: 'i-heroicons-check-circle' },
  in_progress: { label: '进行中', icon: 'i-heroicons-chat-bubble-left-right' },
  paused: { label: '已暂停', icon: 'i-heroicons-pause' },
  abandoned: { label: '已中止', icon: 'i-heroicons-stop-circle' },
  unknown: { label: '状态待确认', icon: 'i-heroicons-question-mark-circle' }
}
export const reportLabels: Record<HistoryReportStatus, string> = {
  pending: '待生成', generating: '分析中', completed: '已就绪', failed: '生成失败', insufficient_data: '信息不足', unknown: '查看详情'
}


export async function cancelHistoryStart(resultId: string) {
  let response: unknown
  try { response = await request.post(`/interview/mock/start-result/${encodeURIComponent(resultId)}/cancel`, {}) }
  catch (error: unknown) {
    if (isAxiosError(error) && error.response?.status === 409) throw new Error('开场仍在处理中，请稍后再取消或刷新记录确认状态')
    if (isAxiosError(error) && error.response?.status === 404) throw new Error('这条记录已不可用，请刷新列表')
    throw new Error('取消暂未完成，请稍后重试；本次结果仍会保留')
  }
  if (!record(response) || response.resultId !== resultId || !['ready', 'cancelled'].includes(String(response.status))) throw new Error('取消结果尚未确认，请重试')
  return response.status as 'ready' | 'cancelled'
}
