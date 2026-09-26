import { useEffect, useState } from 'react'
import CurrentContent from './CurrentContent.jsx'

function CurrentImage({ imageUrl, altText }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [imageUrl])

  return (
    <div>
      <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-2xl border border-white/5 bg-black/20">
        {failed || !imageUrl ? (
          <span className="text-xs text-slate-500">Image unavailable</span>
        ) : (
          <img src={imageUrl} alt={altText} onError={() => setFailed(true)} className="h-full w-full object-cover" />
        )}
      </div>
      {altText && <p className="mt-2 text-xs text-slate-500">Alt: {altText}</p>}
    </div>
  )
}

// Column 1: what is live in AEM right now (read-only).
export default function CurrentPanel({ component }) {
  return (
    <div className="flex h-full flex-col rounded-2xl border-t-4 border-t-coral/70 border-x border-b border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-coral" /> Current · AEM
      </div>
      {component.type === 'image' ? (
        <CurrentImage imageUrl={component.currentImageUrl} altText={component.altText} />
      ) : (
        <CurrentContent content={component.currentContent} componentType={component.type} />
      )}
    </div>
  )
}
