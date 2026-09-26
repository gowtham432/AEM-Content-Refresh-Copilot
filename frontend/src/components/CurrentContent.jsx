function Accordion({ content }) {
  const items = content.split(/\n\s*\n/).filter(Boolean)
  return (
    <div className="divide-y divide-white/10">
      {items.map((item, i) => {
        const [title, ...rest] = item.split('\n')
        return (
          <div key={i} className="py-3 first:pt-0 last:pb-0">
            <div className="text-sm font-semibold text-slate-200">{title}</div>
            <div className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{rest.join('\n')}</div>
          </div>
        )
      })}
    </div>
  )
}

function Teaser({ content }) {
  return (
    <div className="space-y-3">
      {content.split('\n').filter(Boolean).map((line, i) => {
        const idx = line.indexOf(':')
        const label = idx > 0 ? line.slice(0, idx) : ''
        const value = idx > 0 ? line.slice(idx + 1).trim() : line
        return (
          <div key={i}>
            {label && (
              <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
            )}
            <div className="text-sm leading-relaxed text-slate-300">{value}</div>
          </div>
        )
      })}
    </div>
  )
}

export default function CurrentContent({ content, componentType }) {
  return (
    <div className="h-full min-h-[10rem] rounded-2xl border border-white/5 bg-black/20 p-5">
      {componentType === 'accordion' ? (
        <Accordion content={content} />
      ) : componentType === 'teaser' ? (
        <Teaser content={content} />
      ) : (
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{content}</div>
      )}
    </div>
  )
}
