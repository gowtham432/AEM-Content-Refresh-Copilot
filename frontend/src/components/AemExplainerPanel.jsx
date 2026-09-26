import { useEffect, useState } from 'react'

// Paths served by the built-in mock AEM (backend/mock_data.py).
const SAMPLE_PAGES = [
  {
    icon: '🛒',
    title: 'Product page',
    path: '/content/nuvox/us/en/products/airwave-pro',
    detail: '7 components: Title, Text ×4 (2 in an accordion), Image, Teaser',
  },
  {
    icon: '🏢',
    title: 'About page',
    path: '/content/nuvox/us/en/about-us',
    detail: '3 components: Text ×2, Image',
  },
]

function VideoLink({ url }) {
  return url ? (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="grad-btn inline-flex items-center gap-2 rounded-full px-5 py-2 text-xs font-semibold"
    >
      ▶ Watch the demo video
    </a>
  ) : (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-200">
      ▶ Demo video: see the Kaggle project description
    </span>
  )
}

// Shown only in demo mode (mock AEM). Explains why nothing changes on a live site and where to
// see the real thing, and offers one-click sample pages.
export default function AemExplainerPanel({ videoUrl, hasPage, isLoading, onLoad }) {
  const [open, setOpen] = useState(true)

  // Get out of the way once the user has a page on screen (they can reopen it).
  useEffect(() => {
    if (hasPage) setOpen(false)
  }, [hasPage])

  return (
    <section className="glass mx-auto w-full max-w-[1440px] rounded-3xl border-violet-400/20 p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 text-left"
      >
        <span className="rounded-full bg-violet-500/20 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-violet-300">
          Demo mode
        </span>
        <span className="flex-1 text-sm text-slate-300">
          Content comes from a <strong className="text-ghost">mock AEM server</strong>. Publishing is logged, not sent to a
          live site.
        </span>
        <span className="text-xs font-semibold text-slate-400">{open ? 'Hide ▲' : 'Details ▼'}</span>
      </button>

      {open && (
        <div className="mt-5 space-y-5 border-t border-white/10 pt-5">
          <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-3 text-sm leading-relaxed text-slate-300">
              <p>
                This demo runs against a <strong className="text-ghost">mock AEM server</strong> with sample pages. It answers
                on the same URLs as a real AEM author (<span className="font-mono text-xs">:4502</span>), so the app can't
                tell the difference. AEM is an enterprise platform that needs heavy resources to deploy and test, so{' '}
                <strong className="text-ghost">we can't show live updates on a real AEM site here</strong>.
              </p>
              <p>
                Watch the demo video to see the full flow working against a live AEM instance. The link is in the project
                description on Kaggle.
              </p>
              <VideoLink url={videoUrl} />
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-1 font-bold text-mint">Demo mode</div>
                <p className="text-slate-400">Sends the Sling update to the mock AEM. The change is logged, nothing goes live.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="mb-1 font-bold text-violet-300">Production mode</div>
                <p className="text-slate-400">Same update sent to a real AEM author. The JCR node changes and the site is updated.</p>
              </div>
              <p className="col-span-2 text-slate-500">Same app, same requests. Only the target changes.</p>
            </div>
          </div>

          <div>
            <div className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">
              📄 Try these sample AEM pages
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {SAMPLE_PAGES.map((p) => (
                <button
                  key={p.path}
                  type="button"
                  disabled={isLoading}
                  onClick={() => onLoad(p.path)}
                  className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-violet-400/50 hover:bg-violet-500/10 disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold">
                      {p.icon} {p.title}
                    </span>
                    <span className="text-xs font-semibold text-violet-300 transition group-hover:translate-x-0.5">Load →</span>
                  </div>
                  <div className="mt-1 break-all font-mono text-[11px] text-slate-400">{p.path}</div>
                  <div className="mt-1 text-xs text-slate-500">{p.detail}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
