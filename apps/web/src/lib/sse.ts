import { useUserStore } from '@/stores/userStore'

interface SSECallbacks {
  onMessage?: (data: any) => void
  onError?: (error: Error) => void
  onComplete?: () => void
}

interface SSEOptions {
  callbacks?: SSECallbacks
}

export const ssePost = (path: string, params: any, options?: SSEOptions) => {
  if (typeof window === 'undefined') {
    return { close: () => {} }
  }

  const { callbacks = {} } = options || {}
  const { onMessage, onError, onComplete } = callbacks

  const apiPath = path.startsWith('/') ? path : `/${path}`
  const url = `/api/sse-proxy?path=${encodeURIComponent(apiPath)}`
  let controller: AbortController | null = null

  const connect = async () => {
    try {
      controller = new AbortController()
      const token = useUserStore.getState().token

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }
      if (token) headers.Authorization = `Bearer ${token}`

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('❌ SSE 请求失败:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          onComplete?.()
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim()
            if (data === '[DONE]') {
              onComplete?.()
              return
            }
            try {
              const parsed = JSON.parse(data)
              onMessage?.(parsed)
            } catch (e) {
              onMessage?.({ content: data })
            }
          } else if (line.trim()) {
            // ignore non-data lines
          }
        }
      }
    } catch (error: any) {
      console.error('💥 SSE 错误:', error)
      if (error.name !== 'AbortError') {
        onError?.(error)
      }
    }
  }

  connect()
  return { close: () => controller?.abort() }
}
