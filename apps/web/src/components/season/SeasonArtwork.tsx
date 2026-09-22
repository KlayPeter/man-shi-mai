'use client'

import { ArrowUpRight, Check, AudioLines, Sparkles, Star } from 'lucide-react'
import { useSeason } from './SeasonProvider'

export function SeasonFlower({ className = '' }: { className?: string }) {
  return <svg className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true"><g fill="currentColor">{Array.from({ length: 8 }, (_, i) => <ellipse key={i} cx="60" cy="29" rx="16" ry="29" transform={`rotate(${i * 45} 60 60)`} />)}</g><circle cx="60" cy="60" r="18" fill="var(--season-paper)" /><path d="M53 60h.1m14-.1h.1" stroke="#242431" strokeWidth="5" strokeLinecap="round" /><path d="M55 68q5 4 10 0" stroke="#242431" strokeWidth="2.5" strokeLinecap="round" /></svg>
}

export default function SeasonArtwork() {
  const { season, content } = useSeason()
  return <div className={`season-artwork season-artwork-${season}`} role="img" aria-label={`${content.label}插画：带上简历，练习表达，向心仪的机会出发。图中内容仅为设计示意。`}>
    <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
    <div className="art-grid" />
    <svg className="art-path" viewBox="0 0 600 560" fill="none" aria-hidden="true"><path d="M40 360C-30 130 185 79 243 157c64 90-150 54-107-5C233 18 433 62 481 155c51 100-18 248-155 240-74-4-105-75-54-99 85-39 194 52 234 170" stroke="currentColor" strokeWidth="2" strokeDasharray="7 8" /><path d="m486 457 22 13 6-25" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
    <div className="art-label"><span className="h-2 w-2 rounded-full bg-current" /> YOUR NEXT CHAPTER</div>
    <div key={season} className="art-sticker art-star">{season === 'spring' ? <SeasonFlower /> : <svg viewBox="0 0 120 120" fill="none" aria-hidden="true"><path d="M61 8 74 38 98 25 92 53 113 59 87 76 91 97 67 88 64 114 54 113 53 87 26 95 31 75 8 57 32 51 27 26 48 37Z" fill="currentColor" stroke="#242431" strokeWidth="1.8" strokeLinejoin="round" /><path d="M60 34v63m0-31L43 50m17 27 20-20" stroke="#242431" strokeWidth="2" strokeLinecap="round" /></svg>}</div>
    <div className="art-resume">
      <div className="art-resume-top"><span>MY RESUME</span><ArrowUpRight size={20} /></div>
      <div className="mt-6 flex items-center gap-3"><div className="art-avatar"><span /></div><div><div className="art-line w-20" /><div className="art-line mt-2 w-12 opacity-30" /></div></div>
      <p className="mt-5 text-xl font-extrabold">我的闪光点，<br />值得被看见。</p>
      <div className="mt-5 space-y-2"><div className="art-line w-full opacity-20" /><div className="art-line w-4/5 opacity-20" /><div className="art-line w-3/5 opacity-20" /></div>
      <span className="art-resume-check"><Check size={26} strokeWidth={3} /></span>
    </div>
    <div className="art-ticket">
      <div className="art-ticket-head"><Star size={18} fill="currentColor" /><span>NEXT STOP</span><ArrowUpRight size={22} /></div>
      <div className="art-offer">OFFER<span>!</span></div>
      <p>给认真准备的你</p>
      <div className="art-ticket-bottom"><span>保持期待 · 向前一步</span><div className="art-barcode" /></div>
    </div>
    <div className="art-chat"><AudioLines size={21} /><div><strong>这一题，我练过。</strong><span>多一点练习，多一分底气</span></div><Sparkles size={19} /></div>
    <div className="art-mini-note"><span>{season === 'autumn' ? 'AUTUMN' : 'SPRING'}</span><strong>{season === 'autumn' ? '秋招' : '春招'}<br />加油站</strong></div>
    <svg className="art-spark" viewBox="0 0 70 70" fill="none" aria-hidden="true"><path d="M35 2v22M35 46v22M2 35h22m22 0h22M11 11l15 15m18 18 15 15M11 59l15-15m18-18 15-15" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>
    <span className="art-footnote">梦想不必标准答案。你也是。</span>
  </div>
}
