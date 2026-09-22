import request from '@/lib/request'
export type ReviewStatus = 'not_ready' | 'pending' | 'generating' | 'completed' | 'failed' | 'insufficient_data'
export interface ReviewQuestion { questionNumber: number; question: string; answer: string; score: number | null; comment: string; highlights: string[]; improvements: string[] }
export interface ReviewEvidence { questionNumber: number; quote: string; kind: 'strength' | 'improvement'; feedback: string; practice: string }
export interface InterviewReview {
  resultId: string; type: string; position: string; company: string; status: ReviewStatus; canGenerate: boolean; message: string; questions: ReviewQuestion[]
  report: null | { overallScore: number | null; overallLevel: string; summary: string; radarData: { dimension: string; score: number; description: string }[]; strengths: string[]; weaknesses: string[]; improvements: { category: string; suggestion: string; priority: string }[]; evidence: ReviewEvidence[]; rubricVersion: string | null }
}
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const string = (v: unknown): string => { if (typeof v !== 'string') throw new Error('复盘文本格式异常'); return v }
const strings = (v: unknown): string[] => { if (!Array.isArray(v)) throw new Error('复盘列表格式异常'); return v.map(string) }
const score = (v: unknown): number | null => { if (v === null) return null; if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) throw new Error('复盘评分格式异常'); return v }
export function parseInterviewReview(value: unknown): InterviewReview {
  if (!record(value) || !Array.isArray(value.questions) || !['not_ready', 'pending', 'generating', 'completed', 'failed', 'insufficient_data'].includes(String(value.status)) || typeof value.canGenerate !== 'boolean') throw new Error('复盘响应格式异常')
  const questions = value.questions.map(item => {
    if (!record(item) || typeof item.questionNumber !== 'number' || !Number.isInteger(item.questionNumber) || item.questionNumber < 1) throw new Error('问答序号异常')
    return { questionNumber: item.questionNumber, question: string(item.question), answer: string(item.answer), score: score(item.score), comment: string(item.comment), highlights: strings(item.highlights), improvements: strings(item.improvements) }
  })
  const result: InterviewReview = { resultId: string(value.resultId), type: string(value.type), company: string(value.company), position: string(value.position), status: value.status as ReviewStatus, canGenerate: value.canGenerate, message: string(value.message), questions, report: null }
  if (value.status === 'completed') {
    const report = value.report
    if (!record(report) || !Array.isArray(report.radarData) || !Array.isArray(report.evidence) || !Array.isArray(report.improvements)) throw new Error('复盘报告缺失')
    const evidence: ReviewEvidence[] = report.evidence.map(item => {
      if (!record(item) || typeof item.questionNumber !== 'number' || !['strength', 'improvement'].includes(String(item.kind))) throw new Error('复盘依据格式异常')
      const quote = string(item.quote)
      if (!quote || !questions.find(question => question.questionNumber === item.questionNumber)?.answer.includes(quote)) throw new Error('复盘引用不属于原回答')
      return { questionNumber: item.questionNumber, quote, kind: item.kind as ReviewEvidence['kind'], feedback: string(item.feedback), practice: string(item.practice) }
    })
    result.report = { overallScore: score(report.overallScore), overallLevel: string(report.overallLevel), summary: string(report.summary), strengths: strings(report.strengths), weaknesses: strings(report.weaknesses), rubricVersion: report.rubricVersion === null ? null : string(report.rubricVersion), evidence,
      radarData: report.radarData.map(item => {
        if (!record(item) || score(item.score) === null) throw new Error('维度格式异常')
        return { dimension: string(item.dimension), score: item.score as number, description: typeof item.description === 'string' ? item.description : '' }
      }),
      improvements: report.improvements.map(item => {
        if (!record(item)) throw new Error('建议格式异常')
        return { category: string(item.category), suggestion: string(item.suggestion), priority: typeof item.priority === 'string' ? item.priority : 'medium' }
      })
    }
  }
  return result
}
export async function getInterviewReview(resultId: string, signal?: AbortSignal) {
  return parseInterviewReview(await request.get<unknown, unknown>(`/interview/mock/review/${encodeURIComponent(resultId)}`, { signal }))
}
export async function generateInterviewReview(resultId: string) {
  return parseInterviewReview(await request.post<unknown, unknown>(`/interview/mock/review/${encodeURIComponent(resultId)}/generate`))
}
