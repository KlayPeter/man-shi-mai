import { useRef, useState } from 'react'

export const useSpeechSynthesis = () => {
  const [isEnabled, setIsEnabled] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const speechQueue = useRef<string[]>([])
  const spokenTextCache = useRef(new Set<string>())
  const currentFragment = useRef('')

  const isSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

  const extractSentences = (text: string): string[] => {
    if (!text) return []
    return text
      .split(/([。！？；\n]+)/)
      .reduce((acc: string[], part, index, array) => {
        if (index % 2 === 0 && part.trim()) {
          const punctuation = array[index + 1] || ''
          acc.push(part.trim() + punctuation)
        }
        return acc
      }, [])
      .filter(s => s.trim().length > 0)
  }

  const speakSentence = (sentence: string): Promise<void> => {
    if (!isSupported || !isEnabled || !sentence.trim()) return Promise.resolve()

    return new Promise((resolve, reject) => {
      try {
        const utterance = new SpeechSynthesisUtterance(sentence)
        utterance.lang = 'zh-CN'
        utterance.rate = 2.0
        utterance.pitch = 1
        utterance.volume = 1

        const voices = window.speechSynthesis.getVoices()
        const zhVoice = voices.find((voice) => voice.lang.includes('zh'))
        if (zhVoice) utterance.voice = zhVoice

        utterance.onstart = () => setIsSpeaking(true)
        utterance.onend = () => {
          setIsSpeaking(false)
          resolve()
        }
        utterance.onerror = (event) => {
          console.error('语音合成错误:', event)
          setIsSpeaking(false)
          reject(event)
        }

        window.speechSynthesis.speak(utterance)
      } catch (error) {
        reject(error)
      }
    })
  }

  const processQueue = async () => {
    if (speechQueue.current.length === 0 || !isEnabled) return

    const sentence = speechQueue.current.shift()
    if (!sentence) return

    try {
      await speakSentence(sentence)
    } catch (error) {
      console.error('朗读失败:', error)
    }

    if (speechQueue.current.length > 0) processQueue()
  }

  const handleStreamText = (streamText: string, isFinal = false) => {
    if (!isEnabled || !streamText) return

    currentFragment.current += streamText
    const sentences = extractSentences(currentFragment.current)

    if (sentences.length > 0) {
      const sentencesToSpeak = isFinal ? sentences : sentences.slice(0, -1)
      const remaining = isFinal ? '' : sentences[sentences.length - 1] || ''

      sentencesToSpeak.forEach(sentence => {
        const normalized = sentence.trim()
        if (normalized && !spokenTextCache.current.has(normalized)) {
          spokenTextCache.current.add(normalized)
          speechQueue.current.push(normalized)
        }
      })

      currentFragment.current = remaining

      if (speechQueue.current.length > 0 && !isSpeaking) processQueue()
    }

    if (isFinal && currentFragment.current.trim()) {
      const lastFragment = currentFragment.current.trim()
      if (!spokenTextCache.current.has(lastFragment)) {
        spokenTextCache.current.add(lastFragment)
        speechQueue.current.push(lastFragment)
        if (!isSpeaking) processQueue()
      }
      currentFragment.current = ''
    }
  }

  const stop = () => {
    if (isSupported) {
      window.speechSynthesis.cancel()
      speechQueue.current = []
      setIsSpeaking(false)
    }
  }

  const toggle = () => {
    setIsEnabled(!isEnabled)
    if (isEnabled) stop()
  }

  const reset = () => {
    stop()
    spokenTextCache.current.clear()
    currentFragment.current = ''
  }

  return { isEnabled, isSpeaking, isSupported, handleStreamText, stop, toggle, reset }
}
