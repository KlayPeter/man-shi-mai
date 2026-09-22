import request from '@/lib/request'

export const startInterviewAPI = (data: any) => {
  return request.post('/interview/start', data)
}

export const submitAnswerAPI = (data: any) => {
  return request.post('/interview/answer', data)
}

export const getInterviewReportAPI = (id: string) => {
  return request.get(`/interview/report/${id}`)
}

export const getInterviewHistoryAPI = (params?: any) => {
  return request.get('/interview/history', { params })
}

export const getInterviewDetailAPI = (id: string) => {
  return request.get(`/interview/${id}`)
}
