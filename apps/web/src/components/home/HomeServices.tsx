import Link from 'next/link'
import { ArrowUpRight, FileSearch, MessagesSquare, UsersRound } from 'lucide-react'

const services = [
  { icon: FileSearch, no: '01', title: '面试前，心里有题。', name: '面试押题', description: '从简历和 JD 里找到值得准备的问题，把你的项目经历变成回答素材。', note: '给想知道「会被问什么」的你' },
  { icon: MessagesSquare, no: '02', title: '开口练，才能放开聊。', name: '专项模拟', description: '和 AI 面试官来一场有来有往的问答。那些紧张的瞬间，提前练一遍。', note: '给想练习「怎么回答」的你' },
  { icon: UsersRound, no: '03', title: '让面试官，记住你。', name: '行测 + HR', description: '从情景问题到综合能力，把想法讲清楚，让你的表达更有说服力。', note: '给想把「自己讲清楚」的你' },
]
export default function HomeServices() {
  return <section id="services" className="season-services"><div className="page-container">
    <div className="mb-9 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="season-section-number">01 / FIND YOUR WAY</p><h2 className="section-title">你的准备，有自己的节奏。</h2></div><p className="text-sm leading-7 text-muted">不用一次准备好所有事。<br />选一个起点，先迈出一步。</p></div>
    <div className="grid gap-5 md:grid-cols-3">{services.map(service => <Link key={service.no} href="/interview/start" className="season-service-card group">
      <div className="service-card-art"><div className="service-art-icon"><service.icon size={31} strokeWidth={1.5} aria-hidden="true" /></div><span aria-hidden="true">{service.no}</span></div>
      <p className="mb-2 text-xs font-semibold text-ink/70">{service.name}</p><h3 className="text-xl font-bold tracking-tight text-ink">{service.title}</h3><p className="mb-6 mt-3 text-sm leading-7 text-ink/75">{service.description}</p>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink/15 pt-4"><span className="text-xs text-ink/75">{service.note}</span><ArrowUpRight size={20} aria-hidden="true" /></div>
    </Link>)}</div>
  </div></section>
}
