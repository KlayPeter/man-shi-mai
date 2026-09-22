import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface Position {
  category?: string
  description?: string
  positionId?: string
  level?: string
  positionName?: string
  company?: string
  minSalary?: number
  maxSalary?: number
  jd?: string
}

interface Message {
  role: string
  content: string
  timestamp?: Date
  [key: string]: any
}

interface InterviewState {
  currentStep: number
  isSidebarOpen: boolean
  selectedService: string | null
  selectedPosition: Position
  resumeId: string | null
  resumeText: string
  interviewStatus: 'idle' | 'starting' | 'in_progress' | 'suspend' | 'ended'
  interviewEventType: 'start' | 'question' | 'waiting' | 'thinking' | 'end' | 'error'
  interviewDuration: string
  messages: Message[]
  referenceAnswer: string[]
  interviewerName: string
  resultId: string | null
  sessionId: string | null
  report: any
  plan7Days: any
  reportGenerated: boolean
  resumeType: '' | 'resume' | 'text'
  canGoToNextStep: boolean
  isInterviewing: boolean
  setSelectedPosition: (position: Position) => void
  setSelectedService: (service: string | null) => void
  addMessage: (role: string, content: string, metadata?: any) => void
  updateLastMessage: (content: string, role?: string) => void
  updateReferenceAnswer: (content: string, index: number) => void
  startStreamingMessage: (role?: string) => void
  setReport: (report: any, plan7Days: any) => void
  resetInterview: () => void
  reset: () => void
  setCurrentStep: (step: number) => void
  setInterviewStatus: (status: 'idle' | 'starting' | 'in_progress' | 'suspend' | 'ended') => void
  setInterviewEventType: (type: 'start' | 'question' | 'waiting' | 'thinking' | 'end' | 'error') => void
  setInterviewDuration: (duration: string) => void
  setInterviewerName: (name: string) => void
  setSessionId: (id: string | null) => void
  setResultId: (id: string | null) => void
  setResumeId: (id: string | null) => void
  setResumeText: (text: string) => void
}

const isEmpty = (obj: any) => {
  return Object.keys(obj).length === 0
}

export const useInterviewStore = create<InterviewState>()(
  persist(
    (set, get) => ({
      currentStep: 1,
      isSidebarOpen: true,
      selectedService: null,
      selectedPosition: {},
      resumeId: null,
      resumeText: '',
      interviewStatus: 'idle',
      interviewEventType: 'start',
      interviewDuration: '00:00:00',
      messages: [],
      referenceAnswer: [],
      interviewerName: '正在分配面试官...',
      resultId: null,
      sessionId: null,
      report: null,
      plan7Days: null,
      reportGenerated: false,
      get resumeType() {
        const state = get()
        if (state.resumeId) return 'resume'
        if (state.resumeText) return 'text'
        return ''
      },
      get canGoToNextStep() {
        const state = get()
        if (state.currentStep === 1) {
          return (
            !isEmpty(state.selectedPosition) &&
            (state.resumeId !== null || state.resumeText !== '')
          )
        }
        if (state.currentStep === 2) {
          return state.interviewStatus === 'ended'
        }
        return false
      },
      get isInterviewing() {
        const state = get()
        return (
          state.interviewStatus === 'in_progress' ||
          state.interviewStatus === 'starting'
        )
      },
      setSelectedPosition: (position) => {
        set({ selectedPosition: position })
      },
      setSelectedService: (service) => {
        set({ selectedService: service })
      },
      addMessage: (role, content, metadata = {}) => {
        set((state) => ({
          messages: [
            ...state.messages,
            {
              role,
              content,
              timestamp: new Date(),
              ...metadata
            }
          ]
        }))
      },
      updateLastMessage: (content, role = 'interviewer') => {
        set((state) => {
          const messages = [...state.messages]
          const lastMessage = messages[messages.length - 1]

          if (lastMessage && lastMessage.role === role) {
            lastMessage.content = content
          } else {
            messages.push({
              role,
              content,
              timestamp: new Date()
            })
          }
          return { messages }
        })
      },
      updateReferenceAnswer: (content, index) => {
        set((state) => {
          const referenceAnswer = [...state.referenceAnswer]
          referenceAnswer[index] = content
          return { referenceAnswer }
        })
      },
      startStreamingMessage: (role = 'interviewer') => {
        set((state) => {
          const messages = [...state.messages]
          const lastMessage = messages[messages.length - 1]
          if (
            !lastMessage ||
            lastMessage.role !== role ||
            lastMessage.content !== ''
          ) {
            messages.push({
              role,
              content: '',
              timestamp: new Date()
            })
          }
          return { messages }
        })
      },
      setReport: (report, plan7Days) => {
        set({
          report,
          plan7Days,
          reportGenerated: true,
          currentStep: 3
        })
      },
      resetInterview: () => {
        set({
          interviewStatus: 'idle',
          interviewDuration: '00:00:00',
          messages: [],
          interviewerName: '正在分配面试官...',
          interviewEventType: 'start',
          sessionId: null,
          report: null,
          plan7Days: null,
          reportGenerated: false,
          selectedService: null
        })
      },
      reset: () => {
        set({
          currentStep: 1,
          selectedPosition: {},
          resumeId: null,
          resumeText: '',
          interviewStatus: 'idle',
          interviewDuration: '00:00:00',
          messages: [],
          interviewerName: '正在分配面试官...',
          interviewEventType: 'start',
          sessionId: null,
          report: null,
          plan7Days: null,
          reportGenerated: false,
          selectedService: null
        })
      },
      setCurrentStep: (step) => {
        set({ currentStep: step })
      },
      setInterviewStatus: (status) => {
        set({ interviewStatus: status })
      },
      setInterviewEventType: (type) => {
        set({ interviewEventType: type })
      },
      setInterviewDuration: (duration) => {
        set({ interviewDuration: duration })
      },
      setInterviewerName: (name) => {
        set({ interviewerName: name })
      },
      setSessionId: (id) => {
        set({ sessionId: id })
      },
      setResultId: (id) => {
        set({ resultId: id })
      },
      setResumeId: (id) => {
        set({ resumeId: id })
      },
      setResumeText: (text) => {
        set({ resumeText: text })
      }
    }),
    {
      name: 'interview-storage',
      storage: createJSONStorage(() => localStorage),
      skipHydration: false,
    }
  )
)
