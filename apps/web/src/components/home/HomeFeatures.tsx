import { ArrowUpRight, Check, Target, MessageCircle, ListChecks } from 'lucide-react'
import Link from 'next/link'

export default function HomeFeatures() {
  return (
    <section className="section-spacing bg-white">
      <div className="page-container grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
        <div><p className="season-section-number">03 / MAKE IT COUNT</p><h2 className="section-title !leading-snug">知道哪里答得好，<br />也知道下一步怎么改。</h2><p className="section-description">一次模拟不是终点。把笼统的“感觉还行”，变成有方向的复盘，让每一段经历都讲得更扎实。</p>
          <div className="mt-8 space-y-6">{[{icon: Target,title:'看到回答中的亮点与盲点',text:'从岗位匹配、项目经历和表达方式拆解表现。'},{icon: MessageCircle,title:'把建议变成下一次回答',text:'对照反馈补充细节，练习更清楚的表达结构。'},{icon: ListChecks,title:'让准备有迹可循',text:'保留练习记录，面试前回顾自己的重点。'}].map(item => <div key={item.title} className="flex gap-4"><item.icon size={21} className="mt-1 shrink-0 text-primary-600" aria-hidden="true" /><div><h3 className="text-sm font-semibold text-ink">{item.title}</h3><p className="mt-1 text-sm leading-6 text-muted">{item.text}</p></div></div>)}</div>
          <Link href="/interview/start" className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary-700">开始练习，获得自己的反馈<ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className="relative rounded-2xl border border-ink bg-ink p-5 sm:p-8">
          <div className="mb-6 flex items-center justify-between text-white"><div><p className="text-xs text-white/65">每一次回答，都值得复盘</p><h3 className="mt-2 text-xl font-semibold">你的面试复盘笔记</h3></div><span className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/75">报告示意</span></div>
          <div className="report-example p-5 sm:p-6"><div className="flex items-center justify-between border-b border-line pb-4"><span className="text-sm font-semibold text-ink">项目经历 · 回答分析</span><span className="text-xs text-muted">示例</span></div><p className="mb-5 mt-5 text-lg font-semibold leading-8 text-ink">“做了什么”已经清楚，<br />还可以再讲讲“为什么这样做”。</p><div className="space-y-4">{[{label:'经历描述',value:'清楚',width:'84%'},{label:'决策依据',value:'待展开',width:'55%'},{label:'结果验证',value:'可补充',width:'65%'}].map(item => <div key={item.label}><div className="mb-2 flex justify-between text-xs text-muted"><span>{item.label}</span><span>{item.value}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-primary-100"><div className="h-full rounded-full bg-primary-500" style={{width:item.width}} /></div></div>)}</div><div className="mt-6 rounded-xl bg-primary-100/70 p-4"><p className="flex items-center gap-2 text-xs font-semibold text-primary-800"><Check size={15} aria-hidden="true" />下一次，可以这样准备</p><p className="mt-2 text-sm leading-6 text-primary-800">补充一个关键决策、一个具体行动，以及能说明结果的真实证据。</p></div></div>
          <p className="mt-4 text-center text-xs text-white/60">展示内容为示例，实际反馈由你的练习生成</p>
        </div>
      </div>
    </section>
  )
}
