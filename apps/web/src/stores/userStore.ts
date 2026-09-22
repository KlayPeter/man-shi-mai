import { create } from 'zustand'
import { MAX_RESUME_COUNT } from '@/constants'

interface UserInfo {
  _id?: string
  username?: string
  phone?: string
  roles?: string[]
  isActive?: boolean
  gender?: string
  isVerified?: boolean
  isVip?: boolean
  aiInterviewRemainingCount?: number
  aiInterviewRemainingMinutes?: number
  maiCoinBalance?: number
  resumeRemainingCount?: number
  specialRemainingCount?: number
  behaviorRemainingCount?: number
  openid?: string
  isWechatBound?: boolean
  wechatBoundTime?: string
  createdAt?: string
  updatedAt?: string
  avatar?: string
  email?: string
  hasUsedVirtualPayment?: boolean
}

interface UserState {
  userInfo: UserInfo
  isLogin: boolean
  token: string
  resumes: any[]
  canAddResume: boolean
  hydrated: boolean
  hydrate: () => void
  logout: () => void
  updateUserInfo: (userInfo: Partial<UserInfo>) => void
  updateWalletBalance: (balance: number) => void
  addRechargeRecord: (record: any) => void
  addConsumptionRecord: (record: any) => void
  addResume: (resume: any) => void
  removeResume: (index: number) => void
  updateResumes: (resumes: any[]) => void
  setToken: (token: string) => void
  setIsLogin: (isLogin: boolean) => void
}

const saveToStorage = (token: string, userInfo: UserInfo, resumes: any[]) => {
  if (typeof window === 'undefined') return
  localStorage.setItem('token', token)
  localStorage.setItem('userInfo', JSON.stringify(userInfo))
  localStorage.setItem('resumes', JSON.stringify(resumes))
}

export const useUserStore = create<UserState>((set, get) => ({
  userInfo: {},
  isLogin: false,
  token: '',
  resumes: [],
  hydrated: false,
  get canAddResume() {
    return get().resumes.length < MAX_RESUME_COUNT
  },
  hydrate: () => {
    if (typeof window === 'undefined' || get().hydrated) return
    const token = localStorage.getItem('token') || ''
    const userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}')
    const resumes = JSON.parse(localStorage.getItem('resumes') || '[]')
    set({ token, userInfo, resumes, isLogin: !!token, hydrated: true })
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')
      localStorage.removeItem('resumes')
    }
    set({ isLogin: false, token: '', userInfo: {}, resumes: [] })
  },
  updateUserInfo: (userInfo) => {
    set((state) => {
      const newUserInfo = { ...state.userInfo, ...userInfo }
      saveToStorage(state.token, newUserInfo, state.resumes)
      return { userInfo: newUserInfo }
    })
  },
  updateWalletBalance: (balance) => {
    set((state) => {
      const newUserInfo = { ...state.userInfo, maiCoinBalance: balance }
      saveToStorage(state.token, newUserInfo, state.resumes)
      return { userInfo: newUserInfo }
    })
  },
  addRechargeRecord: (record) => {},
  addConsumptionRecord: (record) => {},
  addResume: (resume) => {
    set((state) => {
      if (state.resumes.length < 5) {
        const newResumes = [...state.resumes, resume]
        saveToStorage(state.token, state.userInfo, newResumes)
        return { resumes: newResumes }
      }
      return state
    })
  },
  removeResume: (index) => {
    set((state) => {
      const newResumes = state.resumes.filter((_, i) => i !== index)
      saveToStorage(state.token, state.userInfo, newResumes)
      return { resumes: newResumes }
    })
  },
  updateResumes: (resumes) => {
    set((state) => {
      saveToStorage(state.token, state.userInfo, resumes)
      return { resumes }
    })
  },
  setToken: (token) => {
    set((state) => {
      saveToStorage(token, state.userInfo, state.resumes)
      return { token, isLogin: !!token }
    })
  },
  setIsLogin: (isLogin) => {
    set({ isLogin })
  }
}))
