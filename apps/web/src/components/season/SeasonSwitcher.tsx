'use client'

import { ArrowDownUp, Flower2, Leaf } from 'lucide-react'
import { useSeason } from './SeasonProvider'
import { isSeasonMode } from '@/lib/recruitment-season'

export default function SeasonSwitcher() {
  const { season, mode, setMode, content } = useSeason()
  const Symbol = season === 'autumn' ? Leaf : Flower2
  return <div className="season-switcher">
    <Symbol size={16} aria-hidden="true" />
    <span className="text-xs font-semibold">{content.label}主题</span>
    <span className="h-3 w-px bg-current opacity-20" aria-hidden="true" />
    <label className="sr-only" htmlFor="season-mode">切换招聘季主题</label>
    <select id="season-mode" value={mode} onChange={event => { if (isSeasonMode(event.target.value)) setMode(event.target.value) }}>
      <option value="auto">跟随时节</option>
      <option value="autumn">秋招季</option>
      <option value="spring">春招季</option>
    </select>
    <ArrowDownUp size={12} aria-hidden="true" />
  </div>
}
