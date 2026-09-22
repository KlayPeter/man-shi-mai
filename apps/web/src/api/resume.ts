import request from '@/lib/request'

export const getResumeListAPI = () => {
  return request.get('/resume/list')
}

export const createResumeAPI = (data: any) => {
  return request.post('/resume', data)
}

export const updateResumeAPI = (id: string, data: any) => {
  return request.put(`/resume/${id}`, data)
}

export const deleteResumeAPI = (id: string) => {
  return request.delete(`/resume/${id}`)
}

export const getResumeDetailAPI = (id: string) => {
  return request.get(`/resume/${id}`)
}
