import { useRef } from 'react'
import { Spinner } from './PageInput.jsx'

export default function PromptEditor({ prompt, onChange, onRegenerate, onUpload, isLoading }) {
  const fileRef = useRef(null)

  return (
    <div className="mt-3">
      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-500">
        Prompt · edit, then regenerate
      </div>
      <textarea
        value={prompt}
        onChange={(e) => onChange(e.target.value)}
        disabled={isLoading}
        rows={5}
        className="block w-full resize-y rounded-xl border border-white/10 bg-black/25 p-3 font-mono text-xs leading-relaxed text-slate-300 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/20 disabled:opacity-50"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isLoading || !prompt.trim()}
          className="grad-btn flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold"
        >
          {isLoading ? <Spinner className="h-3 w-3" /> : '🔄'} Regenerate
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={isLoading}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-mint/60 hover:bg-mint/10 disabled:opacity-40"
        >
          ⬆️ Upload my own
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = '' // allow re-picking the same file
          }}
        />
      </div>
    </div>
  )
}
