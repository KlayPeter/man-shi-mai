export default function Brand({ light = false }: { light?: boolean }) {
  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap items-center gap-2.5 ${light ? 'text-white' : 'text-ink'}`}>
      <svg viewBox="0 0 100 100" className={`h-10 w-10 shrink-0 ${light ? 'text-lime' : 'text-primary-600'}`} aria-hidden="true" focusable="false">
        <path fill="currentColor" fillRule="evenodd" d="M28 12H72A20 20 0 0 1 92 32V62A20 20 0 0 1 72 82H46L23 94V81A20 20 0 0 1 8 62V32A20 20 0 0 1 28 12ZM25 60V39Q25 32 31 32Q34 32 37 35L50 48L63 35Q66 32 69 32Q75 32 75 39V60Q75 65 70 65Q65 65 65 60V48L54 59Q50 63 46 59L35 48V60Q35 65 30 65Q25 65 25 60Z" />
      </svg>
      <span className="text-xl font-bold tracking-tight">面试麦<span className={`ml-2 text-xs font-normal tracking-wider ${light ? 'text-white/60' : 'text-muted'}`}>AI</span></span>
    </span>
  )
}
