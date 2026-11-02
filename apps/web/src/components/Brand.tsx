export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-2.5 ${light ? 'text-white' : 'text-ink'}`}>
      <svg viewBox="0 0 100 100" className={`h-10 w-10 shrink-0 ${light ? 'text-lime' : 'text-primary-600'}`} aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M13 78V33C13 21 18 15 26 15C34 15 39 21 39 28C39 32 37 35 34 38L50 54L66 38C63 35 61 32 61 28C61 21 66 15 74 15C82 15 87 21 87 33V78C87 86 74 86 74 78V54L56 72Q50 78 44 72L26 54V78C26 86 13 86 13 78Z" />
      </svg>
      <span className="text-xl font-bold tracking-tight">面试麦<span className={`ml-2 text-xs font-normal tracking-wider ${light ? 'text-white/60' : 'text-muted'}`}>AI</span></span>
    </span>
  )
}
