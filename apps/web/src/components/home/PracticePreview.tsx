'use client'

import { useState } from 'react'
import { AudioLines, ArrowRight, Check, Lightbulb, MessageSquare, RotateCcw } from 'lucide-react'

const examples = [
  { role: '前端开发', question: '聊聊你做过的一次性能优化。你是如何定位问题，并验证优化效果的？', answer: '我先通过性能分析定位首屏加载瓶颈，再拆分非关键资源，并对比优化前后的加载指标。', feedback: '思路清晰。再补充具体指标、你的决策依据，以及优化后的验证过程，会更有说服力。' },
  { role: '产品经理', question: '当用户需求和业务目标发生冲突时，你会如何确定产品的优先级？', answer: '我会先明确双方希望解决的问题，再结合用户影响范围、业务价值和投入成本，和团队确认优先级。', feedback: '有清楚的判断框架。试着加入一个实际案例，说明你做了什么取舍，以及最后的结果。' },
  { role: '运营岗位', question: '如果一场活动的转化低于预期，你会从哪些环节开始复盘？', answer: '我会拆分曝光、点击、参与和转化各环节，定位流失最大的步骤，再结合用户反馈验证原因。', feedback: '拆解路径合理。进一步说明每个环节的判断指标，以及你会优先验证的假设。' },
]

export default function PracticePreview() {
  const [active, setActive] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const example = examples[active]
  return (
    <div id="practice-demo" className="hero-preview scroll-mt-28">
      <div className="practice-window">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold text-ink"><AudioLines size={18} aria-hidden="true" /> 面试练习室</span>
          <span className="rounded-md bg-primary-50 px-2 py-1 text-xs text-primary-700">互动示例</span>
        </div>
        <div className="px-5 py-5 sm:px-6">
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="选择示例岗位">
            {examples.map((item, index) => <button key={item.role} aria-pressed={index === active} onClick={() => { setActive(index); setShowFeedback(false) }} className={`min-h-11 rounded-lg px-3 text-xs font-medium transition-colors ${active === index ? 'bg-ink text-white' : 'bg-paper text-muted hover:bg-primary-50'}`}>{item.role}</button>)}
          </div>
          <div className="mb-4 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-primary-700"><AudioLines size={19} aria-hidden="true" /></span><div><p className="text-sm font-semibold text-ink">麦麦面试官</p><p className="text-xs text-muted">项目经历 · 深度追问</p></div><div className="sound-bars ml-auto" aria-hidden="true">{[8, 16, 23, 12, 20, 8, 15].map((height, i) => <span key={i} style={{ height }} />)}</div></div>
          <p className="preview-question rounded-xl bg-paper p-4 text-[15px] leading-7 text-ink" aria-live="polite">{example.question}</p>
          <div className="mb-5 mt-4 flex gap-3"><span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sand text-xs text-muted">你</span><p className="text-sm leading-7 text-muted">{example.answer}</p></div>
          {showFeedback ? <div role="status" className="rounded-xl border border-primary-200 bg-primary-50 p-4"><p className="mb-2 flex items-center gap-2 text-sm font-semibold text-primary-800"><Lightbulb size={16} aria-hidden="true" />让回答再进一步</p><p className="text-sm leading-6 text-primary-800">{example.feedback}</p><button onClick={() => setShowFeedback(false)} className="mt-2 flex min-h-11 items-center gap-2 text-xs font-semibold text-primary-700"><RotateCcw size={13} aria-hidden="true" />返回示例</button></div> : <button className="flex min-h-12 w-full items-center justify-between rounded-xl border border-line px-4 text-sm font-medium text-ink transition-colors hover:bg-primary-50" onClick={() => setShowFeedback(true)}><span className="flex items-center gap-2"><MessageSquare size={16} aria-hidden="true" />看看这段回答的反馈</span><ArrowRight size={16} aria-hidden="true" /></button>}
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line bg-paper px-5 py-3 text-xs text-muted"><span className="flex items-center gap-1.5"><Check size={13} aria-hidden="true" />支持文字与语音作答</span><span>示例内容，非实际评估</span></div>
      </div>
    </div>
  )
}
