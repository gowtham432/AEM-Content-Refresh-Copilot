import { useState } from 'react'
import CurrentContent from './CurrentContent.jsx'
import SuggestionPanel from './SuggestionPanel.jsx'
import { useSuggest } from '../hooks/useSuggest.js'
import { colorsFor } from './variantColors.js'

export default function TextVariantCard({
  component,
  variant,
  isSelected,
  anotherSelected,
  editedContent, // undefined until the user types in the selected variant
  isLoading,
  onSelect,
  onEdit,
}) {
  const c = colorsFor(variant?.color)
  const draft = editedContent ?? variant?.generatedContent ?? ''
  const { suggestions, isLoadingSuggestions } = useSuggest(
    component.type,
    component.currentContent,
    draft,
    isSelected && editedContent !== undefined,
  )
  const [isApplying, setIsApplying] = useState(false)
  const [applyError, setApplyError] = useState(null)

  const applySuggestion = async (suggestion) => {
    setIsApplying(true)
    setApplyError(null)
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentType: component.type,
          originalContent: component.currentContent,
          userDraft: draft,
          suggestion,
        }),
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      onEdit((await res.json()).updatedContent)
    } catch (e) {
      setApplyError(e.message)
    } finally {
      setIsApplying(false)
    }
  }

  const shell = `flex h-full flex-col rounded-2xl border border-t-4 bg-white/[0.04] p-4 transition ${c.top} ${
    isSelected ? `${c.selected} border-2 border-t-4 shadow-xl` : 'border-white/10'
  } ${anotherSelected ? 'opacity-50 hover:opacity-90' : ''}`

  if (isLoading || !variant) {
    return (
      <div className={shell}>
        <div className="mb-3 h-4 w-28 animate-pulse rounded-full bg-white/10" />
        <div className="relative min-h-[10rem] flex-1 space-y-3 overflow-hidden rounded-xl bg-black/20 p-4">
          <div className="h-3 w-11/12 rounded-full bg-white/10" />
          <div className="h-3 w-full rounded-full bg-white/10" />
          <div className="h-3 w-9/12 rounded-full bg-white/10" />
          <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>
    )
  }

  const failed = !variant.generatedContent

  return (
    <div className={shell}>
      <div className="mb-3">
        <div className={`flex items-center gap-2 text-sm font-bold ${c.text}`}>
          <span className={`h-2 w-2 rounded-full ${c.dot}`} /> {variant.label}
        </div>
        <div className="text-[11px] text-slate-500">
          {variant.model}
          {variant.fallbackFrom && ` (fallback: ${variant.fallbackFrom} unavailable)`}
        </div>
      </div>

      <div className="flex-1">
        {failed ? (
          <p className="rounded-xl border border-coral/30 bg-coral/10 p-3 text-xs text-coral">
            Generation failed{variant.error ? `: ${variant.error}` : ''}. Try Regen All.
          </p>
        ) : isSelected ? (
          <textarea
            value={draft}
            onChange={(e) => onEdit(e.target.value)}
            rows={Math.max(7, draft.split('\n').length + 2)}
            className="block h-full min-h-[10rem] w-full resize-y rounded-xl border border-white/15 bg-black/25 p-4 text-sm leading-relaxed text-ghost focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-500/20"
          />
        ) : (
          <CurrentContent content={variant.generatedContent} componentType={component.type} />
        )}
      </div>

      {isSelected && (
        <>
          {applyError && <p className="mt-2 text-xs text-coral">Could not apply suggestion ({applyError}).</p>}
          <SuggestionPanel
            suggestions={suggestions}
            isLoading={isLoadingSuggestions}
            isApplying={isApplying}
            onApply={applySuggestion}
          />
        </>
      )}

      <button
        type="button"
        disabled={failed}
        onClick={onSelect}
        className={`mt-4 w-full rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
          isSelected ? `${c.button} shadow-lg` : 'border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'
        }`}
      >
        {isSelected ? 'Selected ✓' : '○ Select'}
      </button>
    </div>
  )
}
