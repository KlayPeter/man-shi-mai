export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-2.5 ${light ? 'text-white' : 'text-ink'}`}>
      <svg viewBox="0 0 100 100" className={`h-10 w-10 shrink-0 ${light ? 'text-lime' : 'text-primary-600'}`} aria-hidden="true" focusable="false">
        <circle cx="25" cy="23" r="8" fill="currentColor" />
        <circle cx="75" cy="23" r="8" fill="currentColor" />
        <path d="M13 49C13 41 18 37 25 37H27C34 37 38 42 38 49V55H43C47 55 47 64 43 64H35V76C21 75 13 66 13 53ZM87 49C87 41 82 37 75 37H73C66 37 62 42 62 49V55H57C53 55 53 64 57 64H65V76C79 75 87 66 87 53Z" fill="currentColor" />
        <path d="M41 46H59M50 46V79M41 79H59" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
      </svg>
      <span className="text-xl font-bold tracking-tight">面试麦<span className={`ml-2 text-xs font-normal tracking-wider ${light ? 'text-white/60' : 'text-muted'}`}>AI</span></span>
    </span>
  )
}
