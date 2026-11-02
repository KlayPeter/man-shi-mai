import { useCallback, useEffect, useRef, useState } from 'react'
import { isInterviewSynthesisConfigured, synthesizeInterviewSpeech } from '@/api/interview-speech'
import { useUserStore } from '@/stores/userStore'

export const useSpeechSynthesis = () => {
  const token = useUserStore(s => s.token)
  const [isEnabled, setIsEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isSupported, setIsSupported] = useState(false)
  const [source, setSource] = useState<'cloud' | 'browser'>('browser')
  const [error, setError] = useState('')
  const enabled = useRef(true)
  const mounted = useRef(true)
  const cloud = useRef(false)
  const checking = useRef(!!token)
  const queue = useRef<string[]>([])
  const spoken = useRef(new Set<string>())
  const fragment = useRef('')
  const active = useRef<SpeechSynthesisUtterance | null>(null)
  const audio = useRef<{ player: HTMLAudioElement; url: string } | null>(null)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)

  const disposeAudio = useCallback(() => {
    const current = audio.current
    if (!current) return
    current.player.onended = null; current.player.onerror = null
    current.player.pause(); current.player.removeAttribute('src')
    URL.revokeObjectURL(current.url); audio.current = null
  }, [])
  const stop = useCallback(() => {
    generation.current++
    queue.current = []; fragment.current = ''; spoken.current.clear()
    request.current?.abort(); request.current = null
    disposeAudio()
    if (active.current) { active.current.onstart = null; active.current.onend = null; active.current.onerror = null }
    active.current = null
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    if (mounted.current) { setIsSpeaking(false); setError('') }
  }, [disposeAudio])

  const processQueue = useCallback(function next() {
    if (!mounted.current || !enabled.current || checking.current || active.current || audio.current || request.current) return
    const sentence = queue.current.shift()
    if (!sentence) { setIsSpeaking(false); return }
    const id = generation.current
    const fail = () => {
      if (!mounted.current || generation.current !== id) return
      request.current = null; active.current = null; disposeAudio(); queue.current = []
      setIsSpeaking(false); setError('朗读未完成，请点击重听；也可以直接阅读问题。')
    }
    if (cloud.current) {
      const controller = new AbortController(); request.current = controller
      setIsSpeaking(true)
      void synthesizeInterviewSpeech(sentence, controller.signal).then(blob => {
        if (!mounted.current || generation.current !== id || controller.signal.aborted) return
        request.current = null
        const url = URL.createObjectURL(blob)
        const player = new Audio(url)
        audio.current = { player, url }
        player.onended = () => {
          if (!mounted.current || generation.current !== id) return
          disposeAudio(); next()
        }
        player.onerror = fail
        return player.play()
      }).catch(() => {
        if (!controller.signal.aborted) fail()
      })
      return
    }
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) { fail(); return }
    try {
      const utterance = new SpeechSynthesisUtterance(sentence)
      utterance.lang = 'zh-CN'; utterance.rate = 1; utterance.pitch = 1; utterance.volume = 1
      const voice = window.speechSynthesis.getVoices().find(item => item.lang.startsWith('zh'))
      if (voice) utterance.voice = voice
      active.current = utterance
      utterance.onstart = () => { if (mounted.current && generation.current === id) setIsSpeaking(true) }
      utterance.onend = () => {
        if (!mounted.current || generation.current !== id) return
        active.current = null; next()
      }
      utterance.onerror = fail
      window.speechSynthesis.speak(utterance)
    } catch { fail() }
  }, [disposeAudio])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false; stop() }
  }, [stop])
  useEffect(() => {
    const controller = new AbortController()
    const browser = 'speechSynthesis' in window
    cloud.current = false; checking.current = !!token
    setSource('browser'); setIsSupported(browser)
    if (!token) { processQueue(); return () => controller.abort() }
    void isInterviewSynthesisConfigured(controller.signal).then(available => {
      if (controller.signal.aborted) return
      cloud.current = available; checking.current = false
      setSource(available ? 'cloud' : 'browser'); setIsSupported(available || browser)
      processQueue()
    }).catch(() => {
      if (controller.signal.aborted) return
      checking.current = false; processQueue()
    })
    return () => { controller.abort(); stop() }
  }, [token, processQueue, stop])

  const handleStreamText = useCallback((text: string, isFinal = false) => {
    if (!enabled.current || (!text && !isFinal)) return
    setError('')
    fragment.current += text
    const chunks = fragment.current.match(/[^。！？；\n]+[。！？；\n]+|[^。！？；\n]+$/g) || []
    const last = chunks[chunks.length - 1] || ''
    const complete = isFinal || /[。！？；\n]$/.test(last)
    fragment.current = complete ? '' : chunks.pop() || ''
    for (const chunk of chunks) {
      const sentence = chunk.trim()
      if (sentence && !spoken.current.has(sentence)) {
        spoken.current.add(sentence)
        const characters = Array.from(sentence)
        for (let offset = 0; offset < characters.length; offset += 250) queue.current.push(characters.slice(offset, offset + 250).join(''))
      }
    }
    processQueue()
  }, [processQueue])
  const toggle = useCallback(() => {
    enabled.current = !enabled.current
    setIsEnabled(enabled.current)
    if (!enabled.current) stop()
  }, [stop])
  return { isEnabled, isSpeaking, isSupported, source, error, handleStreamText, stop, toggle, reset: stop }
}
