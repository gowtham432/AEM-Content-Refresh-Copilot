import PromptEditor from './PromptEditor.jsx'
import { colorsFor } from './variantColors.js'

export default function ImageVariantCard({
  component,
  variant,
  isSelected,
  anotherSelected,
  isLoading, // whole component still generating
  isRegenerating, // just this variant re-rendering
  prompt,
  onSelect,
  onPromptChange,
  onRegenerate,
  onUpload,
}) {
  const c = colorsFor(variant?.color)
  const busy = isLoading || isRegenerating || !variant

  const shell = `flex h-full flex-col rounded-2xl border border-t-4 bg-white/[0.04] p-4 transition ${c.top} ${
    isSelected ? `${c.selected} border-2 border-t-4 shadow-xl` : 'border-white/10'
  } ${anotherSelected ? 'opacity-50 hover:opacity-90' : ''}`

  return (
    <div className={shell}>
      <div className="mb-3">
        {variant ? (
          <>
            <div className={`flex items-center gap-2 text-sm font-bold ${c.text}`}>
              <span className={`h-2 w-2 rounded-full ${c.dot}`} /> {variant.label}
            </div>
            <div className="text-[11px] text-slate-500">{variant.model}</div>
          </>
        ) : (
          <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
        )}
      </div>

      <div className="relative grid aspect-[4/3] place-items-center overflow-hidden rounded-xl border border-white/10 bg-black/25">
        {busy ? (
          <>
            <div className="z-10 flex flex-col items-center gap-2 text-xs text-violet-200">
              <span className="animate-float text-2xl">🎨</span> Generating…
            </div>
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          </>
        ) : variant.generatedImageUrl ? (
          <img
            src={variant.generatedImageUrl}
            alt={component.altText}
            className="h-full w-full animate-rise object-cover"
          />
        ) : (
          <p className="p-3 text-center text-xs text-coral">
            Image failed{variant.error ? `: ${variant.error}` : ''}.
            {variant.promptUsed && ' Edit the prompt below and regenerate.'}
          </p>
        )}
      </div>

      {variant && variant.error && variant.generatedImageUrl && (
        <p className="mt-2 text-xs text-coral">{variant.error}</p>
      )}

      {isSelected && variant && (
        <PromptEditor
          prompt={prompt}
          onChange={onPromptChange}
          onRegenerate={onRegenerate}
          onUpload={onUpload}
          isLoading={isRegenerating}
        />
      )}

      <div className="mt-auto pt-4">
        <button
          type="button"
          disabled={busy || !variant.generatedImageUrl}
          onClick={onSelect}
          className={`w-full rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            isSelected ? `${c.button} shadow-lg` : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
          }`}
        >
          {isSelected ? 'Selected ✓' : '○ Select'}
        </button>
      </div>
    </div>
  )
}
