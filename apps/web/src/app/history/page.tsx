'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Icon from '@/components/ui/Icon'
import { useInterviewStore } from '@/stores/interviewStore'
import { cancelHistoryStart, getHistoryPage, historyDestination, historyLabels, reportLabels, type HistoryItem, type HistoryType } from '@/api/interview-history'

const tabs: { key: HistoryType; label: string; icon: string }[] = [
  { key: 'resume', label: '面试押题', icon: 'i-heroicons-document-text' },
  { key: 'special', label: '专项面试', icon: 'i-heroicons-light-bulb' },
  { key: 'behavior', label: '行测 + HR', icon: 'i-heroicons-users' }
]
const limit = 10
function formatDate(date: string | null) {
  return date ? new Date(date).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '日期未记录'
}

function RecordCard({ item, type, reload }: { item: HistoryItem; type: HistoryType; reload: () => void }) {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')
  const needsCancellation = type !== 'resume' && ['prepared', 'refunding'].includes(item.startStatus || '')
  const cancel = async () => {
    if (cancelling) return
    setCancelling(true); setError('')
    try {
      const status = await cancelHistoryStart(item.resultId)
      const current = useInterviewStore.getState()
      if (status === 'cancelled' && current.resultId === item.resultId) { current.resetInterview(); useInterviewStore.setState({ resultId: null }); localStorage.removeItem('active-interview') }
      reload()
    } catch (failure: unknown) { setError(failure instanceof Error ? failure.message : '取消未完成，请重试') }
    finally { setCancelling(false) }
  }
  const isQuiz = type === 'resume'
  const ended = item.status === 'completed'
  const state = historyLabels[item.status]
  const ready = item.reportStatus === 'completed'
  return <li className="group rounded-2xl border border-line bg-white p-5 transition-colors hover:border-primary-300">
    <div className="flex items-start gap-4">
      <div aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-line bg-paper text-ink">
        <Icon name={isQuiz ? 'i-heroicons-document-text' : state.icon} className="h-6 w-6" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="break-words text-base font-semibold text-ink">{item.position || '通用岗位'}</h3>
        <p className="mt-1 break-words text-sm text-muted">{item.company || '通用练习'}</p>
        <time dateTime={item.createdAt ?? undefined} className="mt-1 block text-xs text-muted">{formatDate(item.createdAt)}</time>
      </div>
    </div>
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <ol aria-label="练习进度" className="flex items-center gap-2 text-xs">
        <li className={`rounded-lg px-3 py-2 ${ended ? 'bg-primary-50 text-primary-700' : 'bg-paper text-ink'}`}>
          <span className="block text-muted">{isQuiz ? '押题' : '面试'}</span><span className="mt-1 block font-medium">{isQuiz ? '已生成' : item.startStatus === 'prepared' ? '开场未确认' : item.startStatus === 'refunding' ? '取消待完成' : item.startStatus === 'cancelled' ? '开场已取消' : state.label}</span>
        </li>
        {!isQuiz && <><li aria-hidden="true"><Icon name="i-heroicons-arrow-right" className="h-4 w-4 text-muted" /></li>
          <li className={`rounded-lg px-3 py-2 ${ended && ready ? 'bg-primary-50 text-primary-700' : 'bg-paper text-ink'}`}>
            <span className="block text-muted">复盘</span><span className="mt-1 block font-medium">{ended ? reportLabels[item.reportStatus] : '尚未开始'}</span>
          </li></>}
      </ol>
      {needsCancellation ? <button type="button" disabled={cancelling} onClick={() => void cancel()} className="min-h-11 rounded-lg px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 disabled:opacity-50">{cancelling ? '正在核对权益…' : '取消未完成开场'}</button> : <Link href={historyDestination(item, type)} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50">
        {isQuiz ? '查看押题' : ended ? '查看复盘' : '查看问答'}<Icon name="i-heroicons-arrow-top-right-on-square" className="h-4 w-4" />
      </Link>}
    </div>
    {needsCancellation && <p className="mt-3 text-xs text-muted">取消后核对并退还本次已扣次数，再重新准备。正在处理的开场需稍后重试。</p>}
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </li>
}

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<HistoryType>('resume')
  const [page, setPage] = useState(1)
  const [refresh, setRefresh] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [list, setList] = useState<HistoryItem[]>([])
  const [loadError, setLoadError] = useState(false)
  const [total, setTotal] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    setIsLoading(true); setLoadError(false)
    getHistoryPage(activeTab, page, limit, controller.signal).then(data => {
      if (controller.signal.aborted) return
      setList(data.list); setTotal(data.total)
    }).catch(() => {
      if (controller.signal.aborted) return
      setLoadError(true); setList([]); setTotal(0)
    }).finally(() => { if (!controller.signal.aborted) setIsLoading(false) })
    return () => controller.abort()
  }, [activeTab, page, refresh])
  const reload = () => setRefresh(value => value + 1)
  const changeTab = (type: HistoryType) => {
    if (activeTab === type) return
    setIsLoading(true); setActiveTab(type); setPage(1); setList([]); setTotal(0)
  }
  const totalPages = Math.max(1, Math.ceil(total / limit))
  return <div className="workspace-page"><div className="page-container">
    <header className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div><p className="mb-2 text-xs font-semibold tracking-[0.15em] text-primary-700">练习 · 回看 · 再出发</p><h1 className="workspace-heading">每一场，都有收获。</h1></div>
      <Link href="/interview/start" className="button-primary"><Icon name="i-heroicons-plus" className="h-4 w-4" />开始新练习</Link>
    </header>
    <section aria-label="练习记录" className="rounded-3xl border border-line bg-white/60 p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="练习类型" className="flex max-w-full flex-wrap gap-2">
          {tabs.map(tab => <button key={tab.key} aria-pressed={activeTab === tab.key} onClick={() => changeTab(tab.key)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors ${activeTab === tab.key ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted hover:text-ink'}`}><Icon name={tab.icon} className="h-4 w-4" />{tab.label}</button>)}
        </div>
        <button onClick={reload} disabled={isLoading} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-muted hover:bg-paper disabled:opacity-50"><Icon name="i-heroicons-arrow-path" className={`h-4 w-4 ${isLoading ? 'motion-safe:animate-spin' : ''}`} />刷新</button>
      </div>
      <div className="mb-4 flex items-center justify-between text-sm"><h2 className="font-semibold text-ink">{tabs.find(tab => tab.key === activeTab)?.label}</h2><span aria-live="polite" className="text-muted">{isLoading ? '加载中' : loadError ? '暂不可用' : `${total} 场记录`}</span></div>
      {isLoading ? <div role="status" className="grid min-h-64 place-items-center text-muted">正在整理练习记录…</div>
        : loadError ? <div role="alert" className="py-16 text-center"><Icon name="i-heroicons-exclamation-circle" className="mx-auto mb-4 h-8 w-8 text-primary-700" /><h3 className="mb-4 font-semibold text-ink">记录暂时没有加载成功</h3><button className="button-secondary" onClick={reload}>重新加载</button></div>
        : !list.length ? <div className="py-16 text-center"><Icon name="i-heroicons-clipboard-document-list" className="mx-auto mb-4 h-12 w-12 text-primary-700" /><h3 className="mb-5 font-semibold text-ink">{page > 1 ? '这一页暂无记录' : '你的下一场练习，从这里开始'}</h3>{page > 1 ? <button className="button-secondary" onClick={() => setPage(1)}>返回第一页</button> : <Link href="/interview/start" className="button-primary">开始一次练习</Link>}</div>
        : <ul className="grid gap-4 lg:grid-cols-2">{list.map(item => <RecordCard key={item.resultId} item={item} type={activeTab} reload={reload} />)}</ul>}
      {!loadError && (total > limit || page > 1) && <nav aria-label="记录分页" className="mt-6 flex items-center justify-center gap-3">
        <button disabled={isLoading || page <= 1} onClick={() => { setIsLoading(true); setPage(value => value - 1) }} className="min-h-11 rounded-lg border border-line px-3 text-sm disabled:opacity-40">上一页</button>
        <span aria-live="polite" className="text-sm text-muted">{page} / {totalPages}</span>
        <button disabled={isLoading || page >= totalPages} onClick={() => { setIsLoading(true); setPage(value => value + 1) }} className="min-h-11 rounded-lg border border-line px-3 text-sm disabled:opacity-40">下一页</button>
      </nav>}
    </section>
  </div></div>
}
