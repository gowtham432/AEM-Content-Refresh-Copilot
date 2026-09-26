export default function EditableContent({ content, onChange, isLoading }) {
  if (isLoading) {
    return (
      <div className="relative min-h-[10rem] space-y-3 overflow-hidden rounded-2xl border border-violet-400/30 bg-violet-500/5 p-5">
        <div className="h-3 w-11/12 rounded-full bg-white/10" />
        <div className="h-3 w-full rounded-full bg-white/10" />
        <div className="h-3 w-9/12 rounded-full bg-white/10" />
        <div className="h-3 w-10/12 rounded-full bg-white/10" />
        <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>
    )
  }

  return (
    <textarea
      value={content}
      onChange={(e) => onChange(e.target.value)}
      rows={Math.max(6, content.split('\n').length + 2)}
      className="block h-full min-h-[10rem] w-full resize-y rounded-2xl border border-violet-400/30 bg-violet-500/[0.06] p-5 text-sm leading-relaxed text-ghost shadow-inner shadow-black/20 transition placeholder-slate-500 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/20"
    />
  )
}
