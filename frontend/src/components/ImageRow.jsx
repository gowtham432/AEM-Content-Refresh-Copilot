import CurrentImage from './CurrentImage.jsx'
import GeneratedImage from './GeneratedImage.jsx'
import PromptEditor from './PromptEditor.jsx'

const STATUS = {
  original: { label: 'Original', cls: 'bg-white/10 text-slate-300', dot: 'bg-slate-400' },
  ai: { label: 'AI generated', cls: 'bg-violet-500/20 text-violet-300', dot: 'bg-violet-400' },
  custom: { label: 'Custom prompt', cls: 'bg-coral/15 text-coral', dot: 'bg-coral' },
  uploaded: { label: 'Uploaded', cls: 'bg-mint/15 text-mint', dot: 'bg-mint' },
}

export default function ImageRow({
  component,
  index = 0,
  image,
  draft,
  status,
  isLoading,
  error,
  onDraftChange,
  onRegenerate, // fresh auto-written prompt
  onRegenerateWithPrompt,
  onUpload,
}) {
  const badge = STATUS[status] || STATUS.original

  return (
    <section
      className="glass animate-rise overflow-hidden rounded-3xl shadow-xl shadow-black/30 transition hover:border-white/20"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500/40 to-coral/30 text-lg">
          🖼️
        </span>
        <div>
          <h2 className="font-display text-base font-bold leading-tight">{component.label}</h2>
          <span className="text-[11px] uppercase tracking-widest text-slate-500">image</span>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isLoading}
          title="Write a brand-new prompt and generate again"
          className="ml-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-violet-400/60 hover:bg-violet-500/15 disabled:opacity-40"
        >
          <span className={isLoading ? 'animate-spin' : ''}>🔄</span> Regen
        </button>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" /> Before · current in AEM
          </div>
          <CurrentImage imageUrl={component.currentImageUrl} altText={component.altText} />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-violet-300">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" /> After · AI generated ✨
            </span>
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${badge.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
          </div>
          <GeneratedImage imageUrl={image?.url} isLoading={isLoading} altText={component.altText} />
          {error && <p className="mt-2 text-xs text-coral">Image failed ({error}). Try Regen.</p>}
          <PromptEditor
            prompt={draft ?? ''}
            onChange={onDraftChange}
            onRegenerate={onRegenerateWithPrompt}
            onUpload={onUpload}
            isLoading={isLoading}
          />
        </div>
      </div>
    </section>
  )
}
