import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import PracticePreview from './PracticePreview'

export default function HomePractice() {
  return <section className="season-demo-section"><div className="page-container season-demo-layout">
    <div><p className="season-section-number">02 / A LITTLE PRACTICE</p><h2 className="section-title !leading-snug">别只在脑海里演练。<br />把好回答，练出来。</h2><p className="mt-5 text-sm leading-8 text-muted">“我知道怎么做，但不知道怎么说。”<br />从一个问题开始，看看麦麦如何帮你把经历讲清楚。</p><div className="season-demo-steps"><p><span>1</span>选一个岗位，看看面试官怎么问</p><p><span>2</span>展开反馈，找到回答还能补充什么</p><p><span>3</span>带上自己的简历，开始你的练习</p></div><Link href="/interview/start" className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-4">轮到我的经历了<ArrowUpRight size={16} /></Link></div>
    <PracticePreview />
  </div></section>
}
