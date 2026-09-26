import { Spinner } from './PageInput.jsx'

export default function SuggestionPanel({ suggestions, onApply, isLoading, isApplying }) {
  if (!isLoading && suggestions.length === 0) return null

  return (
    <div className="mt-3 animate-rise rounded-2xl border border-coral/25 bg-coral/[0.07] p-4 text-xs">
      {isLoading ? (
        <div className="flex items-center gap-2 text-slate-400">
          <Spinner className="h-3 w-3" /> Analyzing your writing...
        </div>
      ) : (
        <>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-coral">
            💡 Suggestions · tap to apply
          </div>
          <ul className="space-y-1.5">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  disabled={isApplying}
                  onClick={() => onApply(s)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left leading-snug text-slate-200 transition hover:border-coral/50 hover:bg-coral/10 disabled:opacity-50"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
          {isApplying && (
            <div className="mt-2 flex items-center gap-2 text-slate-400">
              <Spinner className="h-3 w-3" /> Applying...
            </div>
          )}
        </>
      )}
    </div>
  )
}
