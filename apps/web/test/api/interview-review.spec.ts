import { describe, it, expect, vi } from 'vitest'
vi.mock('@/lib/request', () => ({ default: {} }))
import { parseInterviewReview } from '@/api/interview-review'
const fixture = { resultId: 'fixture', type: 'special', position: '前端', company: '', status: 'failed', canGenerate: true, message: '生成失败', questions: [{ questionNumber: 1, question: '如何优化？', answer: '我做了缓存。', score: null, comment: '', highlights: [], improvements: [] }], report: null }
describe('复盘响应', () => {
  it('失败仍保留原问答，无分析就没有分数', () => {
    expect(parseInterviewReview(fixture)).toMatchObject({ status: 'failed', report: null, questions: [{ answer: '我做了缓存。', score: null }] })
  })
  it('错误状态或缺失报告不能显示完成', () => {
    expect(() => parseInterviewReview({ ...fixture, status: '404' })).toThrow()
    expect(() => parseInterviewReview({ ...fixture, status: 'completed' })).toThrow()
  })
  it('历史报告可以没有证据，新引用必须能在原回答中找到', () => {
    const completed = { ...fixture, status: 'completed', report: { overallScore: 0, overallLevel: '待练习', summary: '复盘', rubricVersion: null, radarData: [], strengths: [], weaknesses: [], improvements: [], evidence: [] } }
    expect(parseInterviewReview(completed).report?.overallScore).toBe(0)
    expect(() => parseInterviewReview({ ...completed, report: { ...completed.report, evidence: [{ questionNumber: 1, quote: '不存在的原文', kind: 'strength', feedback: '反馈', practice: '练习' }] } })).toThrow('复盘引用不属于原回答')
  })
})
