'use client'

import Link from 'next/link'
import { ArrowUpRight, ArrowDown, Sparkles } from 'lucide-react'
import SeasonArtwork from '@/components/season/SeasonArtwork'
import SeasonSwitcher from '@/components/season/SeasonSwitcher'
import { useSeason } from '@/components/season/SeasonProvider'

export default function HomeHero() {
  const { content } = useSeason()
  return <section className="season-hero">
    <div className="page-container">
      <div className="season-toolbar"><span className="season-edition"><span /> {content.english} <span className="hidden sm:inline">/ 面试准备计划</span></span><SeasonSwitcher /></div>
      <div className="season-hero-grid">
        <div className="season-hero-copy">
          <div className="season-kicker"><Sparkles size={15} aria-hidden="true" />{content.tag}<span>READY, SET, GO!</span></div>
          <h1>{content.title}<br /><span>{content.emphasis}</span></h1>
          <p className="season-hero-subtitle">把“我有点紧张”，练成<span>“这题我会。”</span></p>
          <p className="season-hero-description">从简历里的闪光点，到面试时的好表达。<br />麦麦陪你准备，一起奔赴下一站。</p>
          <div className="season-hero-actions"><Link href="/interview/start" className="season-main-button">{content.cta}<ArrowUpRight size={21} aria-hidden="true" /></Link><a href="#practice-demo" className="season-demo-link">先试试看<ArrowDown size={18} aria-hidden="true" /></a></div>
          <div className="season-hero-note"><span className="mini-avatar">M</span><span className="mini-avatar avatar-purple">AI</span><span>你的经历 + 麦麦的追问<br /><strong>让每一次练习，都更接近真实面试。</strong></span></div>
        </div>
        <SeasonArtwork />
      </div>
      <div className="season-strip"><span>简历有亮点</span><Sparkles aria-hidden="true" /><span>回答有逻辑</span><Sparkles aria-hidden="true" /><span>面试有底气</span><Sparkles aria-hidden="true" /><span className="hidden sm:inline">下一站，有你</span><ArrowUpRight aria-hidden="true" /></div>
    </div>
  </section>
}
