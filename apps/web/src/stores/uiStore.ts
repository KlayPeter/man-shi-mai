import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'light',
      setTheme: (theme) => set({ theme })
    }),
    {
      name: 'ui-storage'
    }
  )
)
