import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { useUserStore } from '@/stores/userStore'
import { toast } from '@/stores/toastStore'

let isRedirectingToLogin = false

const handleUnauthorized = () => {
  if (isRedirectingToLogin) return
  isRedirectingToLogin = true
  toast({ title: '登录已过期，请重新登录', color: 'yellow' })
  useUserStore.getState().logout()
  setTimeout(() => {
    isRedirectingToLogin = false
    window.location.href = '/login'
  }, 1500)
}

const instance: AxiosInstance = axios.create({
  baseURL: '/dev-api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
})

instance.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      try {
        const token = useUserStore.getState().token
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch { /* ignore SSR */ }
    }
    return config
  },
  (error) => Promise.reject(error)
)

instance.interceptors.response.use(
  (response: AxiosResponse) => {
    const body = response.data
    if (body && typeof body === 'object' && 'code' in body) {
      if (body.code === 200) {
        return body.data
      }
      if (typeof window !== 'undefined') {
        if (body.code === 401) {
          handleUnauthorized()
        } else {
          toast({ title: body.message || '请求失败', color: 'red' })
        }
      }
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return body
  },
  (error) => {
    const status = error.response?.status
    if (status === 401 && typeof window !== 'undefined') {
      handleUnauthorized()
    }
    return Promise.reject(error)
  }
)

export default instance
