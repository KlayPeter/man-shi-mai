import { useCallback, useEffect, useRef, useState } from 'react'

export const useSpeechSynthesis = () => {
  const [isEnabled, setIsEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const enabled = useRef(true)
  const mounted = useRef(true)
  const queue = useRef<string[]>([])
  const spoken = useRef(new Set<string>())
  const fragment = useRef('')
  const active = useRef<SpeechSynthesisUtterance | null>(null)
  const generation = useRef(0)
  const [isSupported, setIsSupported] = useState(false)

  const stop = useCallback(() => {
    generation.current++
    queue.current = []; fragment.current = ''; spoken.current.clear()
    if (active.current) { active.current.onstart = null; active.current.onend = null; active.current.onerror = null }
    active.current = null
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel()
    if (mounted.current) setIsSpeaking(false)
  }, [])
  useEffect(() => {
    mounted.current = true
    setIsSupported('speechSynthesis' in window)
    return () => { mounted.current = false; stop() }
  }, [stop])

  const processQueue = useCallback(function next() {
    if (!mounted.current || !enabled.current || active.current || typeof window === 'undefined' || !('speechSynthesis' in window)) return
    const sentence = queue.current.shift()
    if (!sentence) { setIsSpeaking(false); return }
    const id = generation.current
    try {
      const utterance = new SpeechSynthesisUtterance(sentence)
      utterance.lang = 'zh-CN'; utterance.rate = 1; utterance.pitch = 1; utterance.volume = 1
      const voice = window.speechSynthesis.getVoices().find(item => item.lang.startsWith('zh'))
      if (voice) utterance.voice = voice
      active.current = utterance
      const finish = () => {
        if (!mounted.current || generation.current !== id) return
        active.current = null; next()
      }
      utterance.onstart = () => { if (mounted.current && generation.current === id) setIsSpeaking(true) }
      utterance.onend = finish; utterance.onerror = finish
      window.speechSynthesis.speak(utterance)
    } catch {
      active.current = null; queue.current = []; setIsSpeaking(false)
    }
  }, [])

  const handleStreamText = useCallback((text: string, isFinal = false) => {
    if (!enabled.current || !text) return
    fragment.current += text
    const chunks = fragment.current.match(/[^。！？；\n]+[。！？；\n]+|[^。！？；\n]+$/g) || []
    const last = chunks[chunks.length - 1] || ''
    const complete = isFinal || /[。！？；\n]$/.test(last)
    fragment.current = complete ? '' : chunks.pop() || ''
    for (const chunk of chunks) {
      const sentence = chunk.trim()
      if (sentence && !spoken.current.has(sentence)) { spoken.current.add(sentence); queue.current.push(sentence) }
    }
    processQueue()
  }, [processQueue])
  const toggle = useCallback(() => {
    enabled.current = !enabled.current
    setIsEnabled(enabled.current)
    if (!enabled.current) stop()
  }, [stop])
  return { isEnabled, isSpeaking, isSupported, handleStreamText, stop, toggle, reset: stop }
}
