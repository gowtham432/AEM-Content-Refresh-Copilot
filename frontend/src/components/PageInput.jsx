import { useState } from 'react'

export default function PageInput({ onFetch, isLoading }) {
  const [path, setPath] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (path.trim() && !isLoading) onFetch(path.trim())
  }

  return (
    <form
      onSubmit={submit}
      className="glass flex items-center gap-2 rounded-full p-1.5 pl-5 shadow-2xl shadow-black/30 transition focus-within:border-violet-400/60 focus-within:ring-4 focus-within:ring-violet-500/20"
    >
      <span className="text-slate-400">🔗</span>
      <input
        value={path}
        onChange={(e) => setPath(e.target.value)}
        placeholder="/content/aisearchspa/us/en/home"
        className="min-w-0 flex-1 bg-transparent py-2 text-sm text-ghost placeholder-slate-500 focus:outline-none"
      />
      <button
        type="submit"
        disabled={isLoading || !path.trim()}
        className="grad-btn flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
      >
        {isLoading ? <Spinner /> : '⚡'}
        Fetch content
      </button>
    </form>
  )
}

export function Spinner({ className = 'h-4 w-4' }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}
