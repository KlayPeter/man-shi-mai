'use client'

import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { useSeason } from '@/components/season/SeasonProvider'
import { SeasonFlower } from '@/components/season/SeasonArtwork'

export default function HomeCTA() {
  const { content } = useSeason()
  return <section className="bg-white pb-16 sm:pb-20"><div className="page-container"><div className="season-closing"><SeasonFlower className="season-closing-flower" /><div className="relative"><p className="mb-4 font-mono text-xs tracking-widest">YOUR NEXT CHAPTER STARTS HERE.</p><h2 className="text-3xl font-extrabold leading-snug tracking-tight">{content.closing}</h2><p className="mt-4 text-sm text-ink/75">好机会在路上。更有准备的你，也是。</p></div><Link href="/interview/start" className="season-main-button relative shrink-0">{content.cta}<ArrowUpRight size={19} aria-hidden="true" /></Link></div></div></section>
}
