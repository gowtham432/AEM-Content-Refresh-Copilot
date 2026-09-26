const STATUS = {
  generating: { label: 'Generating…', cls: 'bg-white/10 text-slate-300', dot: 'bg-slate-400 animate-pulse' },
  ready: { label: 'Pick a variant', cls: 'bg-violet-500/20 text-violet-300', dot: 'bg-violet-400' },
  selected: { label: 'Selected', cls: 'bg-mint/15 text-mint', dot: 'bg-mint' },
  edited: { label: 'User edited', cls: 'bg-mint/15 text-mint', dot: 'bg-mint' },
  error: { label: 'Failed', cls: 'bg-coral/15 text-coral', dot: 'bg-coral' },
}

export default function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.ready
  return (
    <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${s.cls}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}
