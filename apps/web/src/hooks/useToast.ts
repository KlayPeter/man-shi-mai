import { useState, useCallback } from 'react'

interface ToastOptions {
  title: string
  description?: string
  color?: 'green' | 'red' | 'blue' | 'yellow'
  duration?: number
}

export function useToast() {
  const [toasts, setToasts] = useState<(ToastOptions & { id: number })[]>([])

  const add = useCallback((options: ToastOptions) => {
    const id = Date.now()
    const toast = { ...options, id }
    setToasts(prev => [...prev, toast])

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, options.duration || 3000)
  }, [])

  const remove = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return { toasts, add, remove }
}
