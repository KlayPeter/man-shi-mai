import { FileText, Mic, ChartNoAxesCombined } from 'lucide-react'

export default function HomeSteps() {
  const steps = [{icon:FileText,title:'带上你的目标',text:'选择想应聘的岗位，上传简历或粘贴经历，让练习从你出发。'}, {icon:Mic,title:'进入一场模拟',text:'选择练习类型，用文字或语音回答。允许停顿，也允许重新思考。'}, {icon:ChartNoAxesCombined,title:'带走具体的进步',text:'查看练习反馈，整理下一步的准备重点，再去迎接真实面试。'}]
  return <section id="how-it-works" className="section-spacing bg-white"><div className="page-container"><div className="mb-12 text-center"><p className="season-section-number">04 / THREE LITTLE STEPS</p><h2 className="section-title">不用等准备好了，才开始练习。</h2></div><div className="grid gap-8 md:grid-cols-3">{steps.map((step,i)=><div className="relative text-center" key={step.title}><div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-line bg-paper"><step.icon size={25} strokeWidth={1.6} className="text-primary-700" aria-hidden="true" /></div><p className="mb-2 font-mono text-xs text-muted">STEP 0{i+1}</p><h3 className="text-lg font-semibold text-ink">{step.title}</h3><p className="mx-auto mt-3 max-w-[280px] text-sm leading-7 text-muted">{step.text}</p></div>)}</div></div></section>
}
