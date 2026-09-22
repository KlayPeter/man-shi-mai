'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '@/components/ui/Icon'

interface VoiceInputModalProps {
  initialText?: string
  autoStart?: boolean
  onConfirm: (text: string) => void
  onRealtimeUpdate?: (text: string) => void
  profession?: string
  context?: string
}

export default function VoiceInputModal({
  initialText = '',
  onConfirm,
  onRealtimeUpdate = () => {}
}: VoiceInputModalProps) {
  const [transcript, setTranscript] = useState(initialText)
  const [recording, setRecording] = useState(false)
  const [audioURL, setAudioURL] = useState('')
  const [error, setError] = useState('')
  const [recognizing, setRecognizing] = useState(false)
  const [volume, setVolume] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const mimeTypeRef = useRef<string>('audio/webm')
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  const startRecording = async () => {
    setError('')
    setAudioURL('')
    audioChunksRef.current = []

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // 尝试使用支持的最佳格式
      let mimeType = 'audio/webm'
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
        mimeType = 'audio/ogg;codecs=opus'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }
      mimeTypeRef.current = mimeType

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder

      // 添加音量监测
      const audioContext = new AudioContext()
      audioContextRef.current = audioContext
      const source = audioContext.createMediaStreamSource(stream)
      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      analyserRef.current = analyser
      source.connect(analyser)

      const detectVolume = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        setVolume(Math.min(100, average * 2))
        animationFrameRef.current = requestAnimationFrame(detectVolume)
      }
      detectVolume()

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeTypeRef.current })
        const url = URL.createObjectURL(audioBlob)
        setAudioURL(url)
        stream.getTracks().forEach(track => track.stop())
        recognizeSpeech(audioBlob)
      }

      mediaRecorder.start()
      setRecording(true)
    } catch (e: any) {
      setError('无法访问麦克风: ' + e.message)
      console.error('录音失败:', e)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      setVolume(0)

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }

  const recognizeSpeech = async (audioBlob: Blob) => {
    setRecognizing(true)
    setError('')
    try {
      const reader = new FileReader()
      reader.readAsDataURL(audioBlob)
      reader.onloadend = async () => {
        const base64Audio = (reader.result as string).split(',')[1]
        const response = await fetch('/dev-api/interview/speech-to-text', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify({ audio: base64Audio })
        })
        const result = await response.json()
        if (result.code === 200) {
          const text = result.data.text
          setTranscript(text)
          onRealtimeUpdate(text)
        } else {
          setError(result.message || '识别失败')
        }
      }
    } catch (e: any) {
      setError('识别失败: ' + e.message)
    } finally {
      setRecognizing(false)
    }
  }

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
      if (audioURL) {
        URL.revokeObjectURL(audioURL)
      }
    }
  }, [audioURL])

  const barStyle = (n: number) => ({
    animationDelay: `${(n % 6) * 0.12}s`,
    height: `${6 + (n % 5) * 2}px`
  })

  return (
    <div className="flex flex-col items-center justify-center py-4 space-y-4">
      <div className="relative flex items-center justify-center w-full">
        {recording ? (
          <div className="flex items-end justify-center gap-1 h-16">
            {Array.from({ length: 24 }).map((_, n) => (
              <span key={n} className="bar" style={barStyle(n)} />
            ))}
          </div>
        ) : (
          <button
            onClick={startRecording}
            className="w-20 h-20 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors cursor-pointer"
          >
            <Icon name="i-heroicons-microphone" className="w-10 h-10 text-gray-400" />
          </button>
        )}
      </div>

      <div className="text-center space-y-3 mt-8">
        <h3 className={`text-xl font-medium transition-colors duration-300 ${recording ? 'text-rose-600' : recognizing ? 'text-blue-600' : 'text-neutral-900'}`}>
          {recording ? '正在录音...' : recognizing ? '正在识别...' : audioURL ? '识别完成' : '点击麦克风开始录音'}
        </h3>
        <p className="text-sm text-neutral-500">
          {recording ? '点击停止按钮结束录音' : recognizing ? '正在将语音转换为文字，请稍候...' : audioURL ? '可以播放录音或编辑文字后发送' : '点击麦克风按钮开始录音'}
        </p>
        {recording && (
          <div className="mt-4">
            <div className="text-xs text-gray-500 mb-2">麦克风音量: {volume.toFixed(0)}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-100"
                style={{ width: `${volume}%` }}
              />
            </div>
            {volume < 5 && (
              <div className="text-xs text-red-500 mt-2">⚠️ 检测不到声音，请检查麦克风</div>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600 text-center">{error}</p>
        </div>
      )}

      {audioURL && !recording && (
        <div className="w-full mt-4">
          <audio src={audioURL} controls className="w-full" />
        </div>
      )}

      {audioURL && !recording && (
        <div className="w-full mt-4">
          <textarea
            value={transcript}
            onChange={(e) => {
              setTranscript(e.target.value)
              onRealtimeUpdate(e.target.value)
            }}
            placeholder="识别结果会显示在这里，您可以编辑后发送..."
            rows={4}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        {recording ? (
          <button
            onClick={stopRecording}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Icon name="i-heroicons-stop" className="w-4 h-4" />
            停止录音
          </button>
        ) : audioURL ? (
          <>
            <button
              onClick={() => {
                setAudioURL('')
                setTranscript(initialText)
                audioChunksRef.current = []
              }}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Icon name="i-heroicons-arrow-path" className="w-4 h-4" />
              重新录音
            </button>
            <button
              onClick={() => onConfirm(transcript)}
              disabled={!transcript.trim()}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Icon name="i-heroicons-paper-airplane" className="w-4 h-4" />
              发送
            </button>
          </>
        ) : null}
      </div>

      <style jsx>{`
        .bar {
          width: 4px;
          background: rgb(244 63 94);
          border-radius: 2px;
          animation: wave 0.9s infinite ease-in-out;
        }
        @keyframes wave {
          0% { transform: scaleY(0.6); opacity: 0.6; }
          50% { transform: scaleY(1.8); opacity: 1; }
          100% { transform: scaleY(0.6); opacity: 0.6; }
        }
      `}</style>
    </div>
  )
}
