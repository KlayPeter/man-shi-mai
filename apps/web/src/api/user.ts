import request from '@/lib/request'

export const getUserInfoAPI = () => {
  return request.get('/user/info')
}

export const updateUserInfoAPI = (data: any) => {
  return request.put('/user/info', data)
}

export const loginAPI = (data: { email: string; code: string }) => {
  return request.post('/auth/login', data)
}

export const sendCodeAPI = (email: string) => {
  return request.post('/auth/send-code', { email })
}
