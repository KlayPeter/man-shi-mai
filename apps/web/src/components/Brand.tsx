import { AudioLines } from 'lucide-react'

export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-2.5 ${light ? 'text-white' : 'text-ink'}`}>
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${light ? 'bg-white/10 text-lime' : 'bg-ink text-lime'}`}>
        <AudioLines size={22} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="text-xl font-bold tracking-tight">面试麦<span className={`ml-2 text-xs font-normal tracking-wider ${light ? 'text-white/60' : 'text-muted'}`}>AI</span></span>
    </span>
  )
}
