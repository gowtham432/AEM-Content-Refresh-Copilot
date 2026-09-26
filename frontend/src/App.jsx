import { useEffect, useState } from 'react'
import PageInput from './components/PageInput.jsx'
import ComponentRow from './components/ComponentRow.jsx'
import PublishBar from './components/PublishBar.jsx'
import { useFetchPage } from './hooks/useFetchPage.js'
import { useGenerateText } from './hooks/useGenerateText.js'
import { useGenerateImage } from './hooks/useGenerateImage.js'

export default function App() {
  const { fetchPage, page, isLoading, error } = useFetchPage()
  const text = useGenerateText()
  const img = useGenerateImage()
  const { contents, statuses } = text
  const [isPublishing, setIsPublishing] = useState(false)
  const [toast, setToast] = useState(null) // { kind: 'success' | 'error', text }

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(t)
  }, [toast])

  const components = page?.components ?? []
  const anyLoading = [...Object.values(text.loadingIds), ...Object.values(img.loadingIds)].some(Boolean)
  const aiCount =
    Object.values(statuses).filter((s) => s === 'ai').length +
    Object.values(img.images).filter((i) => i.status === 'ai').length
  const editedCount =
    Object.values(statuses).filter((s) => s === 'edited').length +
    Object.values(img.images).filter((i) => i.status !== 'ai').length

  // Image components only go out once there is a generated/uploaded replacement.
  const publishable = components.filter((c) => c.type !== 'image' || img.images[c.id]?.url)

  const handleFetch = async (path) => {
    text.reset()
    img.reset()
    setToast(null)
    const data = await fetchPage(path)
    if (!data) return
    text.generate(data.components.filter((c) => c.type !== 'image'))
    img.generate(data.components.filter((c) => c.type === 'image'))
  }

  const handlePublish = async () => {
    setIsPublishing(true)
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pagePath: page.pagePath,
          components: publishable.map((c) =>
            c.type === 'image'
              ? { id: c.id, type: c.type, jcrPath: c.jcrPath, updatedImageUrl: img.images[c.id].url }
              : { id: c.id, type: c.type, jcrPath: c.jcrPath, updatedContent: contents[c.id] ?? c.currentContent },
          ),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || `Server returned ${res.status}`)
      const data = await res.json()
      setToast({
        kind: 'success',
        text: data.skipped?.length
          ? data.message
          : `Published ${data.published.length} components successfully!`,
      })
    } catch (e) {
      setToast({ kind: 'error', text: `Publish failed: ${e.message}` })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="px-6 pb-6 pt-10">
        <div className="mx-auto max-w-4xl text-center">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold tracking-wide text-slate-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-mint" /> Powered by Gemini
          </div>
          <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            AEM content refresh <span className="grad-text">copilot</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-slate-400">
            Pull a page, watch it get rewritten on-brand, tweak it with live suggestions, publish. Done.
          </p>
          <div className="mx-auto mt-8 max-w-2xl">
            <PageInput onFetch={handleFetch} isLoading={isLoading} />
            {error && (
              <p className="mt-3 rounded-full border border-coral/30 bg-coral/10 px-4 py-2 text-sm text-coral">
                Could not fetch page: {error}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-6 px-6 pb-10 pt-4">
        {page && (
          <div className="animate-rise flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Page</div>
              <h2 className="font-display text-2xl font-bold">{page.pageTitle}</h2>
              <div className="mt-1 text-xs text-slate-500">{page.pagePath}</div>
            </div>
            <div className="flex gap-2 text-xs font-semibold">
              <span className="glass rounded-full px-3 py-1.5 text-slate-300">
                {components.length} component{components.length === 1 ? '' : 's'}
              </span>
              <span className="rounded-full bg-violet-500/20 px-3 py-1.5 text-violet-300">
                {aiCount} AI generated
              </span>
              <span className="rounded-full bg-mint/15 px-3 py-1.5 text-mint">{editedCount} edited</span>
            </div>
          </div>
        )}
        {components.map((c, i) => (
          <ComponentRow
            key={c.id}
            index={i}
            component={c}
            text={{
              generatedContent: contents[c.id],
              status: statuses[c.id] || 'original',
              isLoading: !!text.loadingIds[c.id],
              error: text.errors[c.id],
              onContentChange: (value) => text.edit(c.id, value),
              onRegenerate: () => text.generate([c]),
            }}
            image={{
              image: img.images[c.id],
              draft: img.drafts[c.id],
              status: img.images[c.id]?.status || 'original',
              isLoading: !!img.loadingIds[c.id],
              error: img.errors[c.id],
              onDraftChange: (value) => img.setDraft(c.id, value),
              onRegenerate: () => img.generateOne(c),
              onRegenerateWithPrompt: () => img.generateOne(c, img.drafts[c.id]),
              onUpload: (file) => img.upload(c, file),
            }}
          />
        ))}
        {!page && !isLoading && (
          <div className="mx-auto max-w-3xl pt-6">
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ['🔗', 'Fetch', 'Drop in an AEM page path and we pull every component.'],
                ['✨', 'Refresh', 'Gemini rewrites the copy and generates fresh on-brand images, in parallel.'],
                ['🚀', 'Publish', 'Edit with live tips, then push it back to AEM.'],
              ].map(([icon, title, blurb], i) => (
                <div
                  key={title}
                  className="glass animate-rise rounded-3xl p-5"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500/40 to-coral/30 text-xl">
                    {icon}
                  </div>
                  <div className="font-display font-bold">{title}</div>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{blurb}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {!page && isLoading && (
          <div className="glass mx-auto max-w-3xl animate-pulse rounded-3xl p-10 text-center text-slate-400">
            Pulling components from AEM…
          </div>
        )}
      </main>

      {page && (
        <PublishBar
          onPublish={handlePublish}
          isPublishing={isPublishing}
          disabled={anyLoading}
          componentCount={publishable.length}
        />
      )}

      {toast && (
        <div
          className={`fixed right-6 top-6 z-20 animate-rise rounded-2xl border px-5 py-3 text-sm font-semibold shadow-2xl backdrop-blur-xl ${
            toast.kind === 'success'
              ? 'border-mint/40 bg-mint/15 text-mint shadow-mint/10'
              : 'border-coral/40 bg-coral/15 text-coral shadow-coral/10'
          }`}
        >
          {toast.kind === 'success' ? '🎉 ' : '⚠️ '}
          {toast.text}
        </div>
      )}
    </div>
  )
}
