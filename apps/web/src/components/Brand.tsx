export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-2.5 ${light ? 'text-white' : 'text-ink'}`}>
      <svg viewBox="0 0 100 100" width={40} height={40} className={`h-10 w-10 shrink-0 ${light ? 'text-lime' : 'text-primary-600'}`} aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M23 48V26C23 19 30 16 35 22L50 38L65 22C70 16 77 19 77 26V48C77 55 66 55 66 48V38L54 51Q50 56 46 51L34 38V48C34 55 23 55 23 48Z"/>
        <path d="M13 47C13 65 28 76 50 76S87 65 87 47M50 76V89M36 89H64" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round"/>
      </svg>
      <span className="text-xl font-bold tracking-tight">面试麦<span className={`ml-2 text-xs font-normal tracking-wider ${light ? 'text-white/60' : 'text-muted'}`}>AI</span></span>
    </span>
  )
}
