'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { getRecruitmentSeason, isSeasonMode, SEASON_STORAGE_KEY, seasonContent, type RecruitmentSeason, type SeasonMode } from '@/lib/recruitment-season'

const SeasonContext = createContext({
  season: 'autumn' as RecruitmentSeason,
  mode: 'auto' as SeasonMode,
  setMode: (_mode: SeasonMode) => {},
})

export function SeasonProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [mode, updateMode] = useState<SeasonMode>('auto')
  const [calendarSeason, setCalendarSeason] = useState<RecruitmentSeason>('autumn')
  useEffect(() => {
    const refresh = () => setCalendarSeason(getRecruitmentSeason())
    refresh()
    try {
      const saved = localStorage.getItem(SEASON_STORAGE_KEY)
      if (isSeasonMode(saved)) updateMode(saved)
    } catch { /* Storage is optional; automatic themes still work. */ }
    setReady(true)
    const timer = window.setInterval(refresh, 60_000)
    document.addEventListener('visibilitychange', refresh)
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  const season = mode === 'auto' ? calendarSeason : mode
  useEffect(() => {
    if (!ready) return
    document.documentElement.dataset.season = season
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', season === 'autumn' ? '#fffbf5' : '#f8fbf1')
  }, [ready, season])
  const setMode = (next: SeasonMode) => {
    document.documentElement.dataset.season = next === 'auto' ? calendarSeason : next
    updateMode(next)
    try { localStorage.setItem(SEASON_STORAGE_KEY, next) } catch { /* Keep the session preference. */ }
  }
  return <SeasonContext.Provider value={{ season, mode, setMode }}>{children}</SeasonContext.Provider>
}

export function useSeason() {
  const context = useContext(SeasonContext)
  return { ...context, content: seasonContent[context.season] }
}
