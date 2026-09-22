'use client'

export const dynamic = 'force-dynamic'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useInterviewStore } from '@/stores/interviewStore'
import { useUserStore } from '@/stores/userStore'
import { toast } from '@/stores/toastStore'
import { ssePost } from '@/lib/sse'
import request from '@/lib/request'
import { recoverInterview, parseRecoveredInterview } from '@/api/interview-session'
import { PRACTICE_OPTIONS } from '@/lib/interview-policy'
import { getUserInfoAPI } from '@/api/user'
import Icon from '@/components/ui/Icon'
import InterviewPreflight from '@/components/interview/InterviewPreflight'
import InterviewConfirmModal from '@/components/interview/InterviewConfirmModal'
import AnswerComposer from '@/components/interview/AnswerComposer'
import RestoreInterviewModal from '@/components/interview/RestoreInterviewModal'
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis'

type ServiceType = 'resume' | 'special' | 'behavior'
type StepType = 'input' | 'progress' | 'interview' | 'complete' | 'error'

export default function InterviewPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const interviewStore = useInterviewStore()
  const userStore = useUserStore()

  const serviceType = (searchParams.get('serviceType') || 'resume') as ServiceType
  const step = (searchParams.get('step') || 'input') as StepType
  const resultId = searchParams.get('resultId') || ''
  const isHistory = searchParams.get('history') === 'true'

  const [resumeText, setResumeText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progressLabel, setProgressLabel] = useState('正在准备...')
  const [progressValue, setProgressValue] = useState(0)
  const [progressSteps, setProgressSteps] = useState<{ label: string; progress: number }[]>([])
  const [elapsedTime, setElapsedTime] = useState(0)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const [predictionResults, setPredictionResults] = useState<any[]>([])
  const [predictionSummary, setPredictionSummary] = useState('')
  const [currentResultId, setCurrentResultId] = useState(resultId)
  const [resumeQuizComplete, setResumeQuizComplete] = useState(false)
  const [company, setCompany] = useState(interviewStore.selectedPosition?.company || '')
  const [positionName, setPositionName] = useState(interviewStore.selectedPosition?.positionName || '')
  const [minSalary, setMinSalary] = useState(String(interviewStore.selectedPosition?.minSalary || ''))
  const [maxSalary, setMaxSalary] = useState(String(interviewStore.selectedPosition?.maxSalary || ''))
  const [jd, setJd] = useState(interviewStore.selectedPosition?.jd || '')
  const sseRef = useRef<{ abort: () => void } | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)

  // interview 步骤相关
  const inputMessage = useInterviewStore(s => s.answerDraft)
  const setInputMessage = (answerDraft: string) => useInterviewStore.setState({ answerDraft })
  const answerInFlight = useRef(false)
  const startInFlight = useRef(false)
  const [startError, setStartError] = useState('')
  const recoveryStarted = useRef(false)
  const recoveryRef = useRef<AbortController | null>(null)
  const [isRecovering, setIsRecovering] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [showCountdown, setShowCountdown] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const interviewSseRef = useRef<{ abort: () => void } | null>(null)
  const messages = useInterviewStore(s => s.messages)
  const interviewStatus = useInterviewStore(s => s.interviewStatus)
  const interviewEventType = useInterviewStore(s => s.interviewEventType)
  const sessionId = useInterviewStore(s => s.sessionId)
  const speechSynthesis = useSpeechSynthesis()

  const serviceLabels: Record<ServiceType, string> = {
    resume: '面试押题',
    special: '专项面试模拟',
    behavior: '行测+HR面试'
  }

  const getCategoryName = (category: string) => {
    const map: Record<string, string> = {
      technical: '技术',
      project: '项目经验',
      'soft-skill': '软技能',
      'problem-solving': '问题解决',
      'self-introduction': '自我介绍'
    }
    return map[category] || category
  }

  const getDifficultyLabel = (difficulty: string) => {
    const map: Record<string, string> = {
      easy: '简单',
      medium: '中等',
      hard: '困难'
    }
    return map[difficulty] || difficulty
  }

  const getDifficultyClass = (difficulty: string) => {
    const map: Record<string, string> = {
      easy: 'bg-green-100 text-green-700',
      medium: 'bg-amber-100 text-amber-700',
      hard: 'bg-red-100 text-red-700'
    }
    return map[difficulty] || 'bg-gray-100 text-gray-700'
  }

  const updateQuery = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => params.set(k, v))
    router.push(`/interview?${params.toString()}`)
  }

  // 生成兼容的 UUID
  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const refreshUserInfo = async () => {
    try {
      const userInfo: any = await getUserInfoAPI()
      userStore.updateUserInfo(userInfo)
    } catch (e) {
      console.error('刷新用户信息失败：', e)
    }
  }

  useEffect(() => {
    // 手动触发 zustand persist rehydration
    if (typeof window !== 'undefined') {
      useInterviewStore.persist.rehydrate()
    }

    // 刷新用户信息，确保剩余次数是最新的
    refreshUserInfo()

    // 等待 zustand persist 从 localStorage 恢复状态
    const timer = setTimeout(() => {
      if (recoveryStarted.current) return
      if (useInterviewStore.getState().pendingStart && serviceType !== 'resume') {
        setShowRestoreModal(true)
        if (step !== 'interview') updateQuery({ step: 'interview' })
        return
      }
      if (resultId && isHistory) {
        loadHistory(resultId)
        return
      }

      // 显式场次链接优先于浏览器上一次保存的场次。
      if (resultId && serviceType !== 'resume') {
        if (searchParams.get('restore') !== 'true') updateQuery({ step: 'interview', resultId, restore: 'true' })
        return
      }

      // 优先检查独立的 active-interview localStorage
      const activeInterviewStr = localStorage.getItem('active-interview')

      if (activeInterviewStr) {
        try {
          const activeInterview = JSON.parse(activeInterviewStr)
          const { sessionId: sid, resultId: rid, serviceType: sType } = activeInterview

          // 处理押题恢复
          if (sid && sid.startsWith('resume-quiz-') && sType === 'resume' && serviceType === 'resume') {
            const timeDiff = Date.now() - (activeInterview.timestamp || 0)
            const isRecent = timeDiff < 10 * 60 * 1000 // 10分钟内

            if (isRecent) {
              // 恢复岗位信息到 store - 直接调用 setter 而不是 rehydrate
              if (activeInterview.positionData) {
                const { company, positionName, minSalary, maxSalary, jd } = activeInterview.positionData
                const validMinSalary = Math.min(9999, Math.max(0, Number(minSalary) || 0))
                const validMaxSalary = Math.min(9999, Math.max(0, Number(maxSalary) || 0))

                // 直接调用 setter 设置数据
                interviewStore.setSelectedPosition({
                  company,
                  positionName,
                  minSalary: validMinSalary,
                  maxSalary: validMaxSalary,
                  jd
                })
              }

              if (activeInterview.resumeId) {
                interviewStore.setResumeId(activeInterview.resumeId)
              }

              // 注意：不要在这里清除 active-interview，等押题成功后再清除
              // 这样如果再次刷新，还能继续恢复

              toast({
                title: '检测到中断的押题生成',
                description: '正在自动重新生成...',
                color: 'blue'
              })

              // 延迟执行以确保 store 更新完成
              setTimeout(() => {
                // 验证岗位数据是否已恢复
                const currentState = useInterviewStore.getState()

                if (!currentState.selectedPosition?.positionName) {
                  toast({
                    title: '恢复失败',
                    description: '岗位信息丢失，请重新选择岗位',
                    color: 'red'
                  })
                  router.push('/interview/start')
                  return
                }

                if (step !== 'progress') {
                  updateQuery({ step: 'progress' })
                }
                // 触发重新生成，直接传递恢复的数据
                setTimeout(() => {
                  if (activeInterview.positionData) {
                    const { company, positionName, minSalary, maxSalary, jd } = activeInterview.positionData
                    startResumeQuiz({
                      company,
                      positionName,
                      minSalary: Number(minSalary),
                      maxSalary: Number(maxSalary),
                      jd,
                      resumeId: activeInterview.resumeId
                    })
                  } else {
                    startResumeQuiz()
                  }
                }, 500)
              }, 500)
              return
            } else {
              // 超过10分钟，认为已失败
              clearActiveInterview()
              toast({
                title: '押题生成已超时',
                description: '请重新开始押题',
                color: 'yellow'
              })
            }
          }

          // 处理面试恢复
          if (sid && rid && (sType === 'special' || sType === 'behavior') && sType === serviceType) {
            useInterviewStore.getState().setSessionId(sid)
            useInterviewStore.getState().setResultId(rid)
            useInterviewStore.getState().setInterviewStatus('in_progress')
            updateQuery({ step: 'interview', resultId: rid, restore: 'true' })
            return
          }
        } catch (e) {
          console.error('解析活跃面试数据失败：', e)
        }
      }

      // 备用检查：从 Zustand store 检查
      const currentState = useInterviewStore.getState()

      if (currentState.sessionId &&
          (currentState.interviewStatus === 'in_progress' || currentState.interviewStatus === 'starting')) {
        updateQuery({ step: 'interview', resultId: currentState.resultId || '', restore: 'true' })
        return
      }

      if (!searchParams.get('step')) {
        updateQuery({ step: 'input' })
      }
    }, 300)

    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 检查 URL 参数，显示恢复弹窗
  useEffect(() => {
    if (searchParams.get('restore') === 'true' && step === 'interview') {
      setShowRestoreModal(true)
      // 移除 restore 参数
      const params = new URLSearchParams(searchParams.toString())
      params.delete('restore')
      router.replace(`/interview?${params.toString()}`)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, searchParams])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      interviewSseRef.current?.abort()
      recoveryRef.current?.abort()
      sseRef.current?.abort()
      speechSynthesis.stop()
    }
  }, [])

  // interview 步骤：进入时倒计时后启动 SSE
  useEffect(() => {
    if (step !== 'interview') return
    if (interviewStore.interviewStatus === 'starting' && !useInterviewStore.getState().pendingStart) {
      setShowCountdown(true)
      setCountdown(3)
      let c = 3
      const timer = setInterval(() => {
        c--
        setCountdown(c)
        if (c <= 0) {
          clearInterval(timer)
          setShowCountdown(false)
          startInterviewSSE()
        }
      }, 1000)
      return () => clearInterval(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const loadHistory = async (rid: string) => {
    try {
      if (serviceType === 'resume') {
        const res: any = await request.get(`/interview/resume/quiz/result/${rid}`)
        setPredictionResults((res?.questions || []).map((q: any) => ({ ...q, isOpen: true })))
        setPredictionSummary(res?.summary || '')
      } else {
        const res: any = await request.get(`/interview/mock/result/${rid}/qa`)
        setPredictionResults(res?.questions || [])
      }
      setCurrentResultId(rid)
      if (step !== 'complete') updateQuery({ step: 'complete' })
    } catch (e: any) {
      console.error('加载历史记录失败：', e)
      toast({ title: '加载历史记录失败', description: e.message, color: 'red' })
    }
  }

  const handleRestoreInterview = async () => {
    recoveryStarted.current = true
    setShowRestoreModal(false)
    const currentState = useInterviewStore.getState()
    if (currentState.pendingStart) { void startInterviewSSE(); return }
    const rid = resultId || currentResultId || currentState.resultId
    if (!rid) {
      toast({ title: '恢复失败', description: '面试ID不存在', color: 'red' })
      return
    }

    recoveryRef.current?.abort()
    const controller = new AbortController()
    recoveryRef.current = controller
    setIsRecovering(true)
    try {
      const res = await recoverInterview(rid, controller.signal)
      if (controller.signal.aborted) return
      const pending = useInterviewStore.getState().pendingAnswer
      const switchingSession = currentState.resultId !== rid
      const alreadySaved = pending && res.committedRequestId === pending.requestId && res.questionVersion > pending.expectedVersion
      useInterviewStore.setState({
        messages: res.conversationHistory.map(message => ({ ...message, timestamp: new Date(message.timestamp) })),
        sessionId: res.sessionId, resultId: rid, interviewerName: res.interviewerName,
        questionVersion: res.questionVersion,
        activePracticeIntensity: res.practiceIntensity || null,
        sessionTargetDuration: res.targetDuration || null,
        interviewStatus: res.status === 'completed' ? 'ended' : 'in_progress',
        interviewEventType: res.status === 'completed' ? 'end' : 'waiting',
        ...((alreadySaved || switchingSession) ? { pendingAnswer: null, answerDraft: '' } : {}),
      })
      setIsStreaming(false)
      answerInFlight.current = false
      setCurrentResultId(rid)
      if (res.status === 'completed') clearActiveInterview()
      else saveActiveInterview(res.sessionId, rid, serviceType)
      if (res.busyUntil) toast({ title: '上一轮仍在处理中', description: '草稿已保留，稍后可重试或再次恢复。', color: 'yellow' })

      toast({ title: '已恢复面试', description: '继续您的面试', color: 'green' })
    } catch (error: unknown) {
      if (!controller.signal.aborted) toast({ title: '恢复失败', description: error instanceof Error ? error.message : '请稍后重试', color: 'red' })
    } finally {
      if (!controller.signal.aborted) setIsRecovering(false)
    }
  }

  const handleDiscardInterview = () => {
    setShowRestoreModal(false)
    if (useInterviewStore.getState().pendingStart) { void cancelInterviewStart(); return }
    clearActiveInterview() // 清除活跃面试状态
    interviewStore.resetInterview()
    router.push('/interview/start')
  }

  const handleSubmit = async () => {
    if (!interviewStore.selectedPosition?.positionId) {
      toast({ title: '请先选择岗位', color: 'yellow' })
      router.push('/interview/start')
      return
    }
    if (!interviewStore.resumeId && !interviewStore.resumeText.trim()) {
      toast({ title: '请先选择简历', color: 'yellow' })
      router.push('/interview/start')
      return
    }

    const currentMinSalary = interviewStore.selectedPosition?.minSalary
    const currentMaxSalary = interviewStore.selectedPosition?.maxSalary
    if (!currentMinSalary || !currentMaxSalary) {
      toast({ title: '请填写薪资范围', description: '以便生成更加准确的服务数据', color: 'yellow' })
      return
    }

    const currentJd = interviewStore.selectedPosition?.jd?.trim() || ''
    if (currentJd.length < 50 || currentJd.length > 2000) {
      toast({ title: '请填写更加详细的岗位职责（JD）', description: '以便生成更加准确的服务数据（最少 50 字）', color: 'yellow' })
      return
    }

    const balanceMap: Record<ServiceType, number> = {
      resume: (userStore.userInfo as any)?.resumeRemainingCount ?? 0,
      special: (userStore.userInfo as any)?.specialRemainingCount ?? 0,
      behavior: (userStore.userInfo as any)?.behaviorRemainingCount ?? 0
    }

    // 显示确认弹窗
    setShowConfirmModal(true)
  }

  const handleConfirmStart = () => {
    setShowConfirmModal(false)
    // 确保所有字段都保存到 store
    interviewStore.setSelectedPosition({
      ...interviewStore.selectedPosition,
      company,
      positionName,
      minSalary: Number(minSalary) || 0,
      maxSalary: Number(maxSalary) || 0,
      jd
    })
    if (serviceType === 'resume') {
      startResumeQuiz()
    } else {
      startInterview()
    }
  }

  const startResumeQuiz = async (overrideData?: {
    company?: string
    positionName?: string
    minSalary?: number
    maxSalary?: number
    jd?: string
    resumeId?: string | null
  }) => {
    // 优先使用传入的参数，其次使用 local state，最后使用 store
    const currentCompany = overrideData?.company || company || interviewStore.selectedPosition?.company || '未指定公司'
    const currentPositionName = overrideData?.positionName || positionName || interviewStore.selectedPosition?.positionName || ''
    const currentMinSalary = overrideData?.minSalary?.toString() || minSalary || String(interviewStore.selectedPosition?.minSalary || '')
    const currentMaxSalary = overrideData?.maxSalary?.toString() || maxSalary || String(interviewStore.selectedPosition?.maxSalary || '')
    const currentJd = overrideData?.jd || jd || interviewStore.selectedPosition?.jd || ''
    const currentResumeId = overrideData?.resumeId !== undefined ? overrideData.resumeId : interviewStore.resumeId

    updateQuery({ step: 'progress' })
    setProgressValue(0)
    setProgressLabel('正在准备...')
    setProgressSteps([])
    setPredictionResults([])
    setPredictionSummary('')
    setResumeQuizComplete(false)
    setSubmitting(true)
    setElapsedTime(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsedTime(t => t + 1), 1000)

    // 获取并验证薪资值，确保在有效范围内
    const validMinSalary = Math.min(9999, Math.max(0, Number(currentMinSalary) || 0))
    const validMaxSalary = Math.min(9999, Math.max(0, Number(currentMaxSalary) || 0))

    const params = {
      resumeId: currentResumeId,
      resumeContent: interviewStore.resumeText || resumeText,
      company: currentCompany,
      positionName: currentPositionName,
      minSalary: validMinSalary,
      maxSalary: validMaxSalary,
      jd: currentJd,
      requestId: generateUUID()
    }

    // 保存押题进行状态，使用实际的数据而不是从 store 读取
    saveActiveInterview('resume-quiz-' + params.requestId, 'resume-quiz', serviceType, {
      positionData: {
        company: currentCompany,
        positionName: currentPositionName,
        minSalary: validMinSalary,
        maxSalary: validMaxSalary,
        jd: currentJd
      },
      resumeId: currentResumeId
    })

    const connection = ssePost('/interview/resume/quiz/stream', params, {
      callbacks: {
        onMessage: (data) => {
          if (data.type === 'progress') {
            const step = { label: data.label || data.message || '处理中...', progress: data.progress || 0 }
            setProgressLabel(step.label)
            setProgressValue(step.progress)
            setProgressSteps(prev => [...prev, step])
          } else if (data.type === 'yati-complete') {
            const rid = data.data?.resultId
            setCurrentResultId(rid)
            setPredictionResults((data.data?.questions || []).map((q: any) => ({ ...q, isOpen: true })))
            setPredictionSummary(data.data?.summary || '')
            setResumeQuizComplete(true)
            clearActiveInterview()
            refreshUserInfo() // 刷新用户信息以更新剩余次数
            updateQuery({ step: 'complete', resultId: rid })
          } else if (data.type === 'complete') {
            setResumeQuizComplete(true)
          } else if (data.type === 'error') {
            toast({ title: '押题失败', description: data.error?.message || '网络错误', color: 'red' })
            updateQuery({ step: 'error' })
          }
        },
        onError: (error) => {
          toast({ title: '押题失败', description: error.message || '网络错误', color: 'red' })
          updateQuery({ step: 'error' })
          setSubmitting(false)
          if (timerRef.current) clearInterval(timerRef.current)
        },
        onComplete: () => {
          setSubmitting(false)
          if (timerRef.current) clearInterval(timerRef.current)
        }
      }
    })

    sseRef.current = { abort: () => connection.close() }
  }

  const scrollToBottom = useCallback(() => {
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, 50)
  }, [])

  const startInterviewSSE = useCallback(async () => {
    if (startInFlight.current || serviceType === 'resume') return
    startInFlight.current = true
    setStartError('')
    setIsStreaming(true)
    const current = useInterviewStore.getState()
    const params = current.pendingStart || {
      requestId: crypto.randomUUID(), interviewType: serviceType,
      practiceIntensity: current.practiceIntensity,
      resumeId: current.resumeId || undefined, resumeContent: current.resumeText || undefined,
      company: current.selectedPosition.company || '', positionName: current.selectedPosition.positionName || '',
      minSalary: current.selectedPosition.minSalary, maxSalary: current.selectedPosition.maxSalary,
      jd: current.selectedPosition.jd || '',
    }
    useInterviewStore.setState({ pendingStart: params, interviewStatus: 'starting',
      ...(current.pendingStart ? {} : { messages: [], sessionId: null, resultId: null, questionVersion: 0, pendingAnswer: null, answerDraft: '' }),
    })
    let finished = false
    let cancelled = false
    let ready = false
    let lastQuestion = ''
    const fail = (message: string) => {
      if (finished || cancelled) return
      finished = true
      startInFlight.current = false
      setIsStreaming(false)
      useInterviewStore.setState({ interviewStatus: 'idle' })
      setStartError(message)
    }
    const connection = ssePost('/interview/mock/start', params, { callbacks: {
      onMessage: data => {
        if (cancelled || finished) return
        if (data.type === 'start') {
          if (typeof data.resultId === 'string' && typeof data.sessionId === 'string') {
            useInterviewStore.setState({ resultId: data.resultId, sessionId: data.sessionId })
            setCurrentResultId(data.resultId)
            updateQuery({ step: 'interview', resultId: data.resultId })
            saveActiveInterview(data.sessionId, data.resultId, serviceType)
          }
          if (data.startStatus === 'ready') {
            try {
              const snapshot = parseRecoveredInterview({ ...data, busyUntil: null, committedRequestId: null })
              useInterviewStore.setState({ messages: snapshot.conversationHistory.map(message => ({ ...message, timestamp: new Date(message.timestamp) })),
                interviewerName: snapshot.interviewerName, questionVersion: snapshot.questionVersion,
                activePracticeIntensity: snapshot.practiceIntensity || null,
                sessionTargetDuration: snapshot.targetDuration || null,
                interviewStatus: snapshot.status === 'completed' ? 'ended' : snapshot.status === 'paused' ? 'suspend' : 'in_progress',
              })
              lastQuestion = snapshot.conversationHistory.at(-1)?.content || ''
              ready = true
            } catch { fail('开场响应不完整，请重试确认') }
          }
        } else if (data.type === 'waiting' || data.type === 'end') {
          if (!ready || data.requestId !== params.requestId) { fail('没有收到完整开场确认'); return }
          finished = true
          startInFlight.current = false
          useInterviewStore.setState({ pendingStart: null, interviewEventType: data.type === 'end' ? 'end' : 'waiting' })
          setIsStreaming(false)
          if (data.type === 'end') clearActiveInterview()
          else if (lastQuestion) speechSynthesis.handleStreamText(lastQuestion, true)
          refreshUserInfo()
        } else if (data.type === 'error') {
          if (data.startStatus === 'cancelled') useInterviewStore.setState({ pendingStart: null })
          fail(typeof data.error === 'string' ? data.error : '开场尚未确认')
        }
      },
      onError: () => fail('连接中断，本次开始的请求已保留'),
      onComplete: () => { if (!finished) fail('连接提前结束，开场尚未确认') },
    } })
    interviewSseRef.current = { abort: () => { cancelled = true; connection.close(); startInFlight.current = false } }
  }, [serviceType, speechSynthesis])

  const cancelInterviewStart = async () => {
    const pending = useInterviewStore.getState().pendingStart
    if (!pending) return
    setIsRecovering(true)
    try {
      const response: unknown = await request.post(`/interview/mock/start/${pending.requestId}/cancel`, pending)
      if (!response || typeof response !== 'object' || !('status' in response) || !('resultId' in response) || typeof response.resultId !== 'string') throw new Error('取消结果尚未确认，请重试')
      if (response.status === 'ready') {
        setStartError('开场已完成，点击重试开始即可进入，不会再次扣次。')
        return
      }
      if (response.status !== 'cancelled') throw new Error('取消结果尚未确认，请重试')
      useInterviewStore.getState().resetInterview()
      useInterviewStore.setState({ resultId: null })
      clearActiveInterview()
      router.push('/interview/start')
    } catch (error: unknown) {
      setStartError(error instanceof Error ? error.message : '取消未完成，请重试')
    } finally { setIsRecovering(false) }
  }

  const sendAnswer = useCallback(async (answer: string) => {
    const currentState = useInterviewStore.getState()
    if (answerInFlight.current || !answer.trim() || !currentState.sessionId || currentState.interviewStatus !== 'in_progress') return
    answerInFlight.current = true
    speechSynthesis.stop()
    const previousMessages = currentState.messages.map(message => ({ ...message }))
    const pending = currentState.pendingAnswer
    const submission = pending && pending.answer === answer && pending.expectedVersion === currentState.questionVersion
      ? pending : { requestId: crypto.randomUUID(), expectedVersion: currentState.questionVersion, answer }
    useInterviewStore.setState({ pendingAnswer: submission, answerDraft: answer })
    currentState.addMessage('candidate', answer)
    setIsStreaming(true)
    let finished = false
    let cancelled = false
    let lastInterviewerMessage = ''
    const fail = (message: string) => {
      if (finished || cancelled) return
      finished = true
      answerInFlight.current = false
      useInterviewStore.setState({ messages: previousMessages, interviewEventType: 'waiting' })
      setIsStreaming(false)
      toast({ title: '回答尚未确认', description: `${message}，草稿已保留。可重试同一回答，或恢复面试确认进度。`, color: 'red' })
    }
    const confirm = (version: unknown) => {
      if (!Number.isInteger(version) || version !== submission.expectedVersion + 1) {
        fail('返回的问题版本无效')
        return false
      }
      finished = true
      answerInFlight.current = false
      useInterviewStore.setState({ questionVersion: Number(version), pendingAnswer: null, answerDraft: '' })
      setIsStreaming(false)
      return true
    }
    const connection = ssePost('/interview/mock/answer', { sessionId: currentState.sessionId, ...submission }, {
      callbacks: {
        onMessage: (data) => {
          if (cancelled || finished) return
          const { type, content, questionVersion } = data
          if (type === 'question') {
            useInterviewStore.getState().setInterviewEventType('question')
            useInterviewStore.getState().updateLastMessage(content || '', 'interviewer')
            lastInterviewerMessage = content || ''
            scrollToBottom()
          } else if (type === 'thinking') {
            useInterviewStore.getState().setInterviewEventType('thinking')
          } else if (type === 'waiting' && confirm(questionVersion)) {
            useInterviewStore.getState().setInterviewEventType('waiting')
            if (lastInterviewerMessage) speechSynthesis.handleStreamText(lastInterviewerMessage, true)
          } else if (type === 'end' && confirm(questionVersion)) {
            useInterviewStore.getState().updateLastMessage(content || '', 'interviewer')
            useInterviewStore.setState({ interviewEventType: 'end', interviewStatus: 'ended' })
            clearActiveInterview()
            refreshUserInfo()
            if (content) speechSynthesis.handleStreamText(content, true)
          } else if (type === 'error') fail(data.error || content || '处理失败')
        },
        onError: () => fail('连接中断'),
        onComplete: () => { if (!finished) fail('连接提前结束') },
      },
    })
    interviewSseRef.current = { abort: () => { cancelled = true; connection.close(); answerInFlight.current = false } }
  }, [speechSynthesis])

  const endInterview = useCallback(async () => {
    speechSynthesis.stop()
    const currentState = useInterviewStore.getState()
    const resultId = currentState.resultId || currentResultId
    if (!resultId) {
      toast({ title: '结束面试失败', description: '面试ID不存在', color: 'red' })
      return
    }
    try {
      await request.post(`/interview/mock/end/${resultId}`)
      interviewSseRef.current?.abort()
      useInterviewStore.setState({ pendingAnswer: null, answerDraft: '' })
      useInterviewStore.getState().setInterviewStatus('ended')
      useInterviewStore.getState().setInterviewEventType('end')
      clearActiveInterview() // 清除活跃面试状态
    } catch (e: any) {
      toast({ title: '结束面试失败', description: e.message, color: 'red' })
    }
  }, [currentResultId, speechSynthesis])

  const pauseInterview = async () => {
    const current = useInterviewStore.getState()
    if (!current.resultId || isStreaming || isRecovering || current.interviewStatus !== 'in_progress') return
    setIsRecovering(true)
    speechSynthesis.stop()
    try {
      await request.post(`/interview/mock/pause/${encodeURIComponent(current.resultId)}`, {})
      useInterviewStore.setState({ interviewStatus: 'suspend' })
    } catch (error: unknown) {
      toast({ title: '暂停未完成', description: error instanceof Error ? error.message : '请重试', color: 'red' })
    } finally { setIsRecovering(false) }
  }

  const startInterview = () => {
    interviewStore.setInterviewStatus('starting')
    updateQuery({ step: 'interview' })
  }

  // 保存活跃面试状态到独立的 localStorage
  const saveActiveInterview = (sessionId: string, resultId: string, serviceType: string, extraData?: any) => {
    if (typeof window === 'undefined') return
    localStorage.setItem('active-interview', JSON.stringify({
      sessionId,
      resultId,
      serviceType,
      timestamp: Date.now(),
      ...extraData
    }))
  }

  // 清除活跃面试状态
  const clearActiveInterview = () => {
    if (typeof window === 'undefined') return
    localStorage.removeItem('active-interview')
  }

  const handleNextStep = async () => {
    speechSynthesis.stop()
    if (!currentResultId) {
      toast({ title: '缺少结果 ID', color: 'red' })
      return
    }

    // 简历押题需要等待完全完成
    if (serviceType === 'resume' && !resumeQuizComplete && !isHistory) {
      toast({
        title: '面试评估报告正在努力生成中...预计还需 1 - 2 分钟',
        description: '先看下押题的题目和报告吧～',
        color: 'yellow'
      })
      return
    }

    router.push(`/interview/report?resultId=${currentResultId}&serviceType=${serviceType}&history=true`)
  }

  const SERVICE_CONFIGS: Record<ServiceType, any> = {
    resume: {
      title: '准备你的面试重点', badge: '简历与岗位分析',
      description: '请输入目标岗位的详细信息，AI 将为您生成专属的预测题库与高分回答思路。',
      points: ['智能分析岗位 JD', '预测高频面试题', '提供参考答案与技巧', '生成专业评估报告'],
      icon: 'i-heroicons-document-text', iconClass: 'text-blue-600', iconBgClass: 'bg-blue-100',
      containerClass: 'bg-blue-50/40 border-blue-100/50', badgeClass: 'text-blue-600 bg-blue-50 border-blue-100',
      buttonText: '立即押题', buttonIcon: 'i-heroicons-sparkles', consumeText: '押题权益'
    },
    special: {
      title: '开启专项面试模拟', badge: '1v1 实战训练',
      description: '请输入目标岗位的详细信息，AI 面试官将与您进行深度 1v1 模拟面试对话。',
      points: ['真实面试场景模拟', 'AI 智能追问反馈', '多轮深度问答评估', '生成专业评估报告'],
      icon: 'i-heroicons-bolt', iconClass: 'text-emerald-600', iconBgClass: 'bg-emerald-100',
      containerClass: 'bg-emerald-50/40 border-emerald-100/50', badgeClass: 'text-emerald-600 bg-emerald-50 border-emerald-100',
      buttonText: '开始面试模拟', buttonIcon: 'i-heroicons-bolt', consumeText: '专项面试权益'
    },
    behavior: {
      title: '开启行测 + HR 面试', badge: '综合能力评估',
      description: '请输入目标岗位的详细信息，系统将为您生成行测题库与 HR 面试评估方案。',
      points: ['行测题库模拟测试', 'HR 面试软技能评估', '沟通表达能力分析', '生成专业评估报告'],
      icon: 'i-heroicons-chat-bubble-left-right', iconClass: 'text-purple-600', iconBgClass: 'bg-purple-100',
      containerClass: 'bg-purple-50/40 border-purple-100/50', badgeClass: 'text-purple-600 bg-purple-50 border-purple-100',
      buttonText: '开始行测+HR', buttonIcon: 'i-heroicons-chat-bubble-left-right', consumeText: '行测+HR权益'
    }
  }
  const cfg = SERVICE_CONFIGS[serviceType]
  const MIN_JD = 50
  const MAX_JD = 2000

  if (step === 'input' && serviceType !== 'resume') {
    return <InterviewPreflight type={serviceType} remaining={serviceType === 'special' ? userStore.userInfo.specialRemainingCount : userStore.userInfo.behaviorRemainingCount} onStart={startInterview} />
  }

  if (step === 'input') {
    return (
      <>
        {showConfirmModal && (
          <InterviewConfirmModal
            serviceType={serviceType}
            remainingCount={
              serviceType === 'resume'
                ? (userStore.userInfo as any)?.resumeRemainingCount ?? 0
                : serviceType === 'special'
                ? (userStore.userInfo as any)?.specialRemainingCount ?? 0
                : (userStore.userInfo as any)?.behaviorRemainingCount ?? 0
            }
            onConfirm={handleConfirmStart}
            onClose={() => setShowConfirmModal(false)}
          />
        )}
        <div className="min-h-full flex flex-col items-center px-0 py-6 sm:px-4">
        <div className="w-full max-w-4xl surface-panel overflow-hidden">
          <div className="border-b border-line px-5 py-6 sm:px-8"><p className="eyebrow !mb-2">让练习更贴近真实机会</p><h1 className="text-2xl font-bold text-ink">完善这次练习的目标</h1><p className="mt-2 text-sm text-muted">补充公司与职位要求，麦麦会结合你的经历展开提问。</p></div>

          <div className="p-5 sm:p-8 space-y-6">
            {/* 服务类型提示卡 */}
            <div className={`rounded-xl p-4 flex gap-4 border ${cfg.containerClass}`}>
              <div className="shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cfg.iconBgClass}`}>
                  <Icon name={cfg.icon} className={`w-5 h-5 ${cfg.iconClass}`} />
                </div>
              </div>
              <div className="text-sm text-neutral-600 leading-relaxed flex-1">
                <p className="font-bold text-neutral-900 mb-1 flex items-center gap-2">
                  {cfg.title}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.badgeClass}`}>{cfg.badge}</span>
                </p>
                <p className="text-neutral-500 text-xs mb-2">{cfg.description}</p>
                <ul className="grid sm:grid-cols-2 gap-2 text-xs text-neutral-500">
                  {cfg.points.map((point: string, i: number) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <Icon name="i-heroicons-check-circle" className="w-3.5 h-3.5 text-green-500" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* 表单字段 */}
            <div className="grid gap-6 md:grid-cols-[1fr_1fr_1.4fr]">
              <div className="space-y-2">
                <label htmlFor="target-company" className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
                  <Icon name="i-heroicons-building-office-2" className="w-4 h-4 text-neutral-400" />
                  目标公司
                </label>
                <input
                  id="target-company"
                  value={company}
                  onChange={e => { setCompany(e.target.value); interviewStore.setSelectedPosition({ ...interviewStore.selectedPosition, company: e.target.value }) }}
                  placeholder="请输入公司全称，如：字节跳动"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="target-position" className="flex items-center gap-1.5 text-sm font-semibold text-neutral-700">
                  <Icon name="i-heroicons-briefcase" className="w-4 h-4 text-neutral-400" />
                  岗位名称
                </label>
                <input
                  id="target-position"
                  value={positionName}
                  onChange={e => { setPositionName(e.target.value); interviewStore.setSelectedPosition({ ...interviewStore.selectedPosition, positionName: e.target.value }) }}
                  placeholder="请输入岗位名称，如：前端开发工程师"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="space-y-2">
                <label className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-neutral-700">
                  <span className="flex items-center gap-1.5">
                    <Icon name="i-heroicons-currency-dollar" className="w-4 h-4 text-neutral-400" />
                    薪资范围
                  </span>
                  <span className="text-[10px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">必填</span>
                  <span className="text-xs text-neutral-400 font-normal">以千（K）为单位</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="number"
                      min="0"
                      max="9999"
                      aria-label="最低薪资（千元）"
                      value={minSalary}
                      onChange={e => {
                        const val = Math.min(9999, Math.max(0, Number(e.target.value) || 0))
                        setMinSalary(String(val))
                        interviewStore.setSelectedPosition({ ...interviewStore.selectedPosition, minSalary: val })
                      }}
                      placeholder="最低"
                      className="w-full pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 pointer-events-none">k</span>
                  </div>
                  <Icon name="i-heroicons-arrow-right" className="w-4 h-4 text-neutral-400 shrink-0" />
                  <div className="relative min-w-0 flex-1">
                    <input
                      type="number"
                      min="0"
                      max="9999"
                      aria-label="最高薪资（千元）"
                      value={maxSalary}
                      onChange={e => {
                        const val = Math.min(9999, Math.max(0, Number(e.target.value) || 0))
                        setMaxSalary(String(val))
                        interviewStore.setSelectedPosition({ ...interviewStore.selectedPosition, maxSalary: val })
                      }}
                      placeholder="最高"
                      className="w-full pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 pointer-events-none">k</span>
                  </div>
                </div>
              </div>
            </div>

            {/* JD 文本框 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label htmlFor="target-jd" className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-neutral-700">
                  <Icon name="i-heroicons-document-text" className="w-4 h-4 text-neutral-400" />
                  岗位职责 (JD)
                  <span className="text-[10px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">必填</span>
                  <span className="text-xs text-neutral-400">{MIN_JD} ~ {MAX_JD} 字</span>
                </label>
                <div className="flex items-center gap-2">
                  {jd.length > 0 && (
                    <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded-full border border-green-100 flex items-center gap-1">
                      <Icon name="i-heroicons-check" className="w-3 h-3" />
                      内容已输入
                    </span>
                  )}
                  <span className={`text-xs font-mono ${jd.length > 0 ? 'text-primary-600 font-medium' : 'text-neutral-400'}`}>
                    {jd.length} 字
                  </span>
                </div>
              </div>
              <div className="relative">
                <textarea
                  id="target-jd"
                  value={jd}
                  onChange={e => { setJd(e.target.value); interviewStore.setSelectedPosition({ ...interviewStore.selectedPosition, jd: e.target.value }) }}
                  minLength={MIN_JD}
                  maxLength={MAX_JD}
                  placeholder={`请直接粘贴目标岗位的职位描述（JD）...\n\n提示：越详细的 JD（包含任职要求、技术栈、加分项），生成的押题越准确，最少 ${MIN_JD} 字，最大 ${MAX_JD} 字。\n\n示例：\n1. 负责前端核心业务功能的开发与维护\n2. 熟练掌握 Vue3、TypeScript 等技术栈\n3. 具备良好的跨部门沟通协作能力`}
                  rows={8}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
                />
                {jd.length === 0 && (
                  <div className="absolute bottom-4 right-4 pointer-events-none">
                    <Icon name="i-heroicons-pencil-square" className="w-12 h-12 text-gray-100" />
                  </div>
                )}
              </div>
            </div>

            {/* 底部操作 */}
            <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-muted">确认开始后将消耗 1 次{cfg.consumeText}</p>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full sm:w-auto px-12 py-3 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white rounded-xl text-base font-bold flex items-center justify-center gap-2 transition-colors"
              >
                {cfg.buttonText}
                <Icon name={cfg.buttonIcon} className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
      </>
    )
  }

  if (step === 'progress') {
    const formatTime = (seconds: number) => {
      const m = Math.floor(seconds / 60)
      const s = seconds % 60
      return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-lg bg-white rounded-2xl border border-gray-200 shadow-sm p-8">
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto relative z-10">
              <Icon name="i-heroicons-cpu-chip" className="w-10 h-10 text-primary-500 animate-pulse" />
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-primary-400/20 rounded-full animate-ping" />
          </div>

          <h2 className="text-xl font-bold text-neutral-900 text-center mb-6">{progressLabel}</h2>

          <div className="space-y-2 mb-6">
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div className="bg-primary-500 h-2 rounded-full transition-all duration-500" style={{ width: `${progressValue}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <span className="flex items-center gap-1.5">
                <Icon name="i-heroicons-clock" className="w-3.5 h-3.5" />
                预计耗时 5 - 7 分钟
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono">已耗时 {formatTime(elapsedTime)}</span>
                <span className="text-gray-300">|</span>
                <span>{progressValue.toFixed(0)}%</span>
              </span>
            </div>
          </div>

          <div className="space-y-3 h-64 overflow-y-auto">
            {progressSteps.map((s, i) => {
              const isLast = i === progressSteps.length - 1
              return (
                <div key={i} className={`flex items-center gap-3 text-sm ${isLast ? 'text-primary-600' : 'text-neutral-700'}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs shrink-0 ${isLast ? 'border-primary-500 text-primary-600 bg-white' : 'bg-primary-500 border-primary-500 text-white'}`}>
                    {isLast ? (
                      <Icon name="i-heroicons-arrow-path" className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Icon name="i-heroicons-check" className="w-3.5 h-3.5" />
                    )}
                  </div>
                  <span className="text-left">{s.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'complete') {
    return (
      <div className="space-y-6 pb-12 h-full overflow-y-auto px-6">
        {/* 顶部操作栏 */}
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm flex flex-col sm:flex-row justify-between items-center gap-4 sticky top-4 z-20">
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <Icon name="i-heroicons-check-circle" className="w-5 h-5 text-green-500" />
            <span>
              {serviceType === 'resume'
                ? `${isHistory ? '历史押题数据' : '押题完成'}，共生成 ${predictionResults.length} 道预测题`
                : `${isHistory ? '历史面试记录' : '面试完成'}，共 ${predictionResults.length} 个问答`
              }
            </span>
            <button
              onClick={() => router.push('/history')}
              className="text-xs text-green-500 underline hover:text-green-600 transition-colors"
            >
              后续可在「历史记录」中查看
            </button>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => router.push('/interview/start')}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="i-heroicons-arrow-path" className="w-4 h-4" />
              重新开始
            </button>
            <button
              onClick={handleNextStep}
              className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
            >
              下一步：查看提升计划
              <Icon name="i-heroicons-arrow-right" className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-200px)] pb-10">
          {/* 押题总结 */}
          {predictionSummary && (
            <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl p-6 border border-primary-100 shadow-sm">
              <div className="flex gap-3">
                <div className="shrink-0 mt-1">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <Icon name="i-heroicons-sparkles" className="w-5 h-5 text-primary-600" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="font-bold text-neutral-900">AI 押题分析总结</h3>
                  <div
                    className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: require('marked').marked.parse(predictionSummary) }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 题目列表 */}
          <div className="space-y-6 mt-6">
            {predictionResults.map((item: any, i: number) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden group hover:shadow-md transition-shadow duration-300">
                {/* 题目头部 */}
                <div className="p-5 border-b border-gray-100 bg-gray-50/30">
                  <div className="flex flex-col gap-3">
                    {/* 标签行 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="shrink-0 px-2.5 py-1 rounded-md bg-primary-100 text-primary-700 text-sm font-bold">
                          Q{i + 1}
                        </span>
                        {item.category && (
                          <span className="px-2 py-1 rounded-md bg-purple-100 text-purple-700 text-xs">
                            考察类型：{getCategoryName(item.category)}
                          </span>
                        )}
                        {item.difficulty && (
                          <span className={`px-2 py-1 rounded-md text-xs ${getDifficultyClass(item.difficulty)}`}>
                            题目难度：{getDifficultyLabel(item.difficulty)}
                          </span>
                        )}
                        {item.keywords?.map((kw: string, ki: number) => (
                          <span key={ki} className="px-2 py-1 rounded-md bg-white border border-gray-200 text-neutral-500 text-xs">
                            # {kw}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => setPredictionResults(prev => prev.map((q, idx) => idx === i ? { ...q, isOpen: !q.isOpen } : q))}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        {item.isOpen ? '折叠' : '展开'}
                        <Icon name={item.isOpen ? 'i-heroicons-chevron-up' : 'i-heroicons-chevron-down'} className="w-3 h-3" />
                      </button>
                    </div>

                    {/* 题目内容 */}
                    <h3
                      className="text-lg font-medium text-neutral-900 leading-relaxed cursor-pointer hover:text-primary-600 transition-colors"
                      onClick={() => setPredictionResults(prev => prev.map((q, idx) => idx === i ? { ...q, isOpen: !q.isOpen } : q))}
                    >
                      {item.question}
                    </h3>

                    {/* 考察意图 */}
                    {item.reasoning && item.isOpen && (
                      <div className="flex items-start gap-2 text-xs text-neutral-500 bg-gray-100/50 p-2 rounded-lg">
                        <Icon name="i-heroicons-eye" className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>
                          <span className="font-medium">考察意图：</span>
                          {item.reasoning}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 题目内容主体 */}
                {item.isOpen && (
                  <div className="p-6 space-y-5">
                    {/* 回答要点 */}
                    {item.tips && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-600">
                          <Icon name="i-heroicons-light-bulb" className="w-4 h-4" />
                          <span>回答要点</span>
                        </div>
                        <div className="pl-6 text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                          {item.tips}
                        </div>
                      </div>
                    )}

                    {/* 参考回答 */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-primary-600">
                        <Icon name="i-heroicons-chat-bubble-bottom-center-text" className="w-4 h-4" />
                        <span>参考回答思路</span>
                      </div>
                      <div
                        className="pl-6 text-sm text-neutral-700 leading-relaxed prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: require('marked').marked.parse(item.answer || '') }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
            {predictionResults.length === 0 && (
              <div className="text-center py-16 text-neutral-400">
                <Icon name="i-heroicons-document-text" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>暂无押题结果</p>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'interview') {
    const canSend = interviewStatus === 'in_progress' && !isRecovering && (!resultId || interviewStore.resultId === resultId)
    const isEnded = interviewStatus === 'ended'

    return (
      <div className="h-full flex flex-col">
        {/* 倒计时遮罩 */}
        {showCountdown && (
          <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm text-white">
            <div className="text-9xl font-bold mb-8 animate-pulse text-primary-400">{countdown}</div>
            <p className="text-2xl font-medium tracking-wide text-center px-8">面试即将开始，请保持网络稳定</p>
          </div>
        )}

        {/* 恢复面试弹窗 */}
        <RestoreInterviewModal
          open={showRestoreModal}
          serviceType={serviceType}
          onRestore={handleRestoreInterview}
          onDiscard={handleDiscardInterview}
        />

        {/* 顶部信息栏 */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6 border-b border-line bg-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Icon name="i-heroicons-sparkles" className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{interviewStore.interviewerName}</p>
              <p className="text-xs text-gray-400">{serviceLabels[serviceType]}{interviewStore.activePracticeIntensity && interviewStore.sessionTargetDuration
                ? ` · ${PRACTICE_OPTIONS.find(option => option.value === interviewStore.activePracticeIntensity)?.label || ''} · ${interviewStore.sessionTargetDuration} 分钟上限`
                : ''}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={speechSynthesis.toggle}
              disabled={!speechSynthesis.isSupported}
              aria-pressed={speechSynthesis.isEnabled && speechSynthesis.isSupported}
              className={`inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                speechSynthesis.isEnabled
                  ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
              title={speechSynthesis.isEnabled ? '关闭语音' : '开启语音'}
            >
              <Icon name={speechSynthesis.isEnabled ? 'i-heroicons-speaker-wave' : 'i-heroicons-speaker-x-mark'} className="w-3.5 h-3.5" />
              {!speechSynthesis.isSupported ? '朗读不可用' : speechSynthesis.isEnabled ? '朗读开启' : '朗读关闭'}
            </button>
            {(isStreaming || interviewStatus === 'in_progress') && !isEnded && (
              <button
                onClick={() => {
                  speechSynthesis.stop()
                }}
                className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 text-xs font-medium transition-colors"
                title="停止当前朗读"
                disabled={!speechSynthesis.isSpeaking}
              >
                <Icon name="i-heroicons-forward" className="w-3.5 h-3.5" />
                停止朗读
              </button>
            )}
            {!isEnded && !interviewStore.pendingStart && <>
              <button type="button" disabled={isStreaming || isRecovering || !sessionId} onClick={interviewStatus === 'suspend' ? handleRestoreInterview : pauseInterview} className="min-h-11 rounded-lg border border-line px-3 text-xs text-muted disabled:opacity-50">{interviewStatus === 'suspend' ? '继续面试' : '暂停面试'}</button>
              <button type="button" disabled={isStreaming || isRecovering || interviewStatus !== 'in_progress' || !speechSynthesis.isSupported} onClick={() => { const question = [...messages].reverse().find(message => message.role === 'interviewer'); if (question) { speechSynthesis.stop(); if (!speechSynthesis.isEnabled) speechSynthesis.toggle(); speechSynthesis.handleStreamText(question.content, true) } }} className="min-h-11 rounded-lg border border-line px-3 text-xs text-muted disabled:opacity-50">再听一遍</button>
            </>}
            {!isEnded && <button type="button" onClick={handleRestoreInterview} disabled={isStreaming || isRecovering}
              className="inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border border-line px-3 text-xs text-muted disabled:opacity-50">
              <Icon name="i-heroicons-arrow-path" className="h-3.5 w-3.5" />同步进度
            </button>}
            {isEnded ? (
              <button
                onClick={() => {
                  const rid = interviewStore.resultId || currentResultId
                  if (rid) {
                    router.push(`/interview/report?resultId=${rid}&serviceType=${serviceType}&history=true`)
                  } else {
                    toast({ title: '无法查看报告', description: '面试ID不存在，请重新开始面试', color: 'red' })
                  }
                }}
                className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 text-white text-xs font-medium hover:bg-green-700 transition-colors"
              >
                <Icon name="i-heroicons-document-text" className="w-3.5 h-3.5" />
                查看报告
              </button>
            ) : (
              <button
                onClick={endInterview}
                disabled={!!interviewStore.pendingStart || isRecovering || (!!resultId && interviewStore.resultId !== resultId)}
                className="inline-flex min-h-11 shrink-0 whitespace-nowrap items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-red-500 text-xs font-medium hover:bg-red-50 transition-colors"
              >
                <Icon name="i-heroicons-stop-circle" className="w-3.5 h-3.5" />
                结束面试
              </button>
            )}
          </div>
        </div>

        {startError && <div role="alert" className="mx-4 mt-4 rounded-2xl border border-line bg-paper p-4 sm:mx-6">
          <p className="text-sm text-ink">{startError}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" onClick={() => void startInterviewSSE()} disabled={isStreaming || isRecovering}
              className="min-h-11 rounded-xl bg-primary-600 px-4 text-sm text-white disabled:opacity-50">重试开始</button>
            {interviewStore.pendingStart && <button type="button" onClick={() => void cancelInterviewStart()} disabled={isStreaming || isRecovering}
              className="min-h-11 rounded-xl border border-line px-4 text-sm disabled:opacity-50">取消开始</button>}
          </div>
        </div>}
        {/* 消息列表 */}
        {interviewStatus === 'suspend' && <p role="status" className="bg-primary-50 px-6 py-3 text-sm text-primary-900">已暂停，草稿已保留。继续后从当前问题接着回答。</p>}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 && !isStreaming && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Icon name="i-heroicons-chat-bubble-left-right" className="w-16 h-16 text-gray-200 mb-4" />
              <p className="text-neutral-400 text-sm">面试即将开始...</p>
            </div>
          )}
          {(messages as any[]).map((msg: any, i: number) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'candidate' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                msg.role === 'candidate' ? 'bg-primary-100' : 'bg-gradient-to-br from-indigo-500 to-purple-600'
              }`}>
                <Icon name={msg.role === 'candidate' ? 'i-heroicons-user' : 'i-heroicons-sparkles'}
                  className={`w-5 h-5 ${msg.role === 'candidate' ? 'text-primary-600' : 'text-white'}`} />
              </div>
              <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'candidate'
                  ? 'bg-primary-600 text-white rounded-tr-none'
                  : 'bg-white border border-gray-100 text-neutral-800 rounded-tl-none'
              }`}>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
          {isStreaming && (
            <div className="flex gap-3">
              <div className="shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                <Icon name="i-heroicons-sparkles" className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-2">
                <div className="flex gap-1">
                  {[0, 0.2, 0.4].map((delay, i) => (
                    <div key={i} className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}s` }} />
                  ))}
                </div>
                <span className="text-xs text-gray-400">AI 思考中...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {!isEnded && <AnswerComposer key={interviewStore.answerMode} initialMode={interviewStore.answerMode} value={inputMessage} onChange={setInputMessage}
          onSend={sendAnswer} disabled={!canSend || isStreaming}
          onBeforeRecord={speechSynthesis.stop} />}

        {isEnded && (
          <div className="border-t border-gray-100 p-4 bg-green-50 shrink-0 text-center">
            <p className="text-sm text-green-700 font-medium mb-2">🎉 面试已结束，感谢您的参与！</p>
            <button
              onClick={() => {
                const rid = interviewStore.resultId || currentResultId
                if (rid) {
                  router.push(`/interview/report?resultId=${rid}&serviceType=${serviceType}&history=true`)
                } else {
                  toast({ title: '无法查看报告', description: '面试ID不存在，请重新开始面试', color: 'red' })
                }
              }}
              className="px-6 py-2 bg-green-600 text-white rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors"
            >
              查看面试报告
            </button>
          </div>
        )}
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8">
        <div className="w-full max-w-md bg-white rounded-2xl border border-red-100 shadow-sm p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Icon name="i-heroicons-exclamation-triangle" className="w-8 h-8 text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-neutral-900 mb-2">处理失败</h2>
          <p className="text-sm text-neutral-500 mb-6">网络错误或服务异常，请稍后重试</p>
          <button
            onClick={() => updateQuery({ step: 'input' })}
            className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            重新尝试
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center text-neutral-400">
        <Icon name="i-heroicons-arrow-path" className="w-8 h-8 mx-auto mb-2 animate-spin" />
        <p className="text-sm">加载中...</p>
      </div>
    </div>
  )
}
