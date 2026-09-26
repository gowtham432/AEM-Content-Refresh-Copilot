import { useState } from 'react'
import CurrentContent from './CurrentContent.jsx'
import EditableContent from './EditableContent.jsx'
import SuggestionPanel from './SuggestionPanel.jsx'
import { useSuggest } from '../hooks/useSuggest.js'

const ICONS = { text: '📄', accordion: '📋', teaser: '🖼️', title: '🔤' }

const STATUS = {
  original: { label: 'Original', cls: 'bg-white/10 text-slate-300', dot: 'bg-slate-400' },
  ai: { label: 'AI generated', cls: 'bg-violet-500/20 text-violet-300', dot: 'bg-violet-400' },
  edited: { label: 'User edited', cls: 'bg-mint/15 text-mint', dot: 'bg-mint' },
}

export default function ComponentRow({
  component,
  generatedContent,
  status,
  isLoading,
  error,
  onContentChange,
  onRegenerate,
  index = 0,
}) {
  const { suggestions, isLoadingSuggestions } = useSuggest(
    component.type,
    component.currentContent,
    generatedContent,
    status === 'edited',
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
          userDraft: generatedContent,
          suggestion,
        }),
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      onContentChange((await res.json()).updatedContent)
    } catch (e) {
      setApplyError(e.message)
    } finally {
      setIsApplying(false)
    }
  }

  const badge = STATUS[status] || STATUS.original

  return (
    <section
      className="glass animate-rise overflow-hidden rounded-3xl shadow-xl shadow-black/30 transition hover:border-white/20"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500/40 to-coral/30 text-lg">
          {ICONS[component.type] || '📄'}
        </span>
        <div>
          <h2 className="font-display text-base font-bold leading-tight">{component.label}</h2>
          <span className="text-[11px] uppercase tracking-widest text-slate-500">{component.type}</span>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={isLoading}
          className="ml-auto flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-violet-400/60 hover:bg-violet-500/15 disabled:opacity-40"
        >
          <span className={isLoading ? 'animate-spin' : ''}>🔄</span> Regen
        </button>
      </header>

      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-coral" /> Before · read-only
          </div>
          <CurrentContent content={component.currentContent} componentType={component.type} />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-violet-300">
              <span className="h-1.5 w-1.5 rounded-full bg-mint" /> After · editable ✨
            </span>
            <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold ${badge.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
              {badge.label}
            </span>
          </div>
          <EditableContent
            content={generatedContent ?? component.currentContent}
            onChange={onContentChange}
            isLoading={isLoading}
          />
          {error && (
            <p className="mt-2 text-xs text-coral">
              Generation failed ({error}). Showing original content — try Regen.
            </p>
          )}
          {applyError && <p className="mt-2 text-xs text-coral">Could not apply suggestion ({applyError}).</p>}
          <SuggestionPanel
            suggestions={suggestions}
            isLoading={isLoadingSuggestions}
            isApplying={isApplying}
            onApply={applySuggestion}
          />
        </div>
      </div>
    </section>
  )
}
