import { create } from 'zustand'

export type ToastColor = 'green' | 'red' | 'yellow' | 'blue' | 'gray'

export interface ToastItem {
  id: number
  title: string
  description?: string
  color?: ToastColor
  duration?: number
}

interface ToastStore {
  toasts: ToastItem[]
  add: (options: Omit<ToastItem, 'id'>) => void
  remove: (id: number) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add: (options) => {
    const id = Date.now() + Math.random()
    set((s) => ({ toasts: [...s.toasts, { ...options, id }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, options.duration ?? 3000)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export function toast(options: Omit<ToastItem, 'id'>) {
  useToastStore.getState().add(options)
}
