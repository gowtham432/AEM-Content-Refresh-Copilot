import CurrentPanel from './CurrentPanel.jsx'
import TextVariantCard from './TextVariantCard.jsx'
import ImageVariantCard from './ImageVariantCard.jsx'
import StatusBadge from './StatusBadge.jsx'
import { Spinner } from './PageInput.jsx'

const ICONS = { text: '📄', accordion: '📋', teaser: '🖼️', title: '🔤', image: '🖼️' }
const PLACEHOLDER_COUNT = 3

// One component: [ current | variant A | variant B | variant C ].
// `text` / `img` are the two variant hooks; the one matching the component type is used.
export default function ComponentSection({ component, index = 0, text, img }) {
  const isImage = component.type === 'image'
  const h = isImage ? img : text
  const id = component.id

  const variants = h.variants[id]
  const isLoading = !!h.loadingIds[id]
  const error = h.errors[id]
  const selected = h.selected[id] ?? null
  const isEdited = !isImage && text.edits[id] !== undefined

  const status = isLoading
    ? 'generating'
    : error
      ? 'error'
      : selected
        ? isEdited
          ? 'edited'
          : 'selected'
        : 'ready'

  const selectText = (variantId) => {
    if (selected === variantId) return
    if (isEdited && !window.confirm('Switch variant? Your edits on the current selection will be lost.')) return
    text.select(id, variantId)
  }

  // Shimmering placeholders only while generating; after a total failure just show the error.
  const slots = variants ?? (isLoading ? Array.from({ length: PLACEHOLDER_COUNT }, () => null) : [])

  return (
    <section
      className="glass animate-rise rounded-3xl p-5 shadow-xl shadow-black/30"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500/40 to-coral/30 text-lg">
          {ICONS[component.type] || '📄'}
        </span>
        <div>
          <h2 className="font-display text-base font-bold leading-tight">{component.label}</h2>
          <span className="text-[11px] uppercase tracking-widest text-slate-500">{component.type}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <StatusBadge status={status} />
          <button
            type="button"
            onClick={() => h.generate([component])}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-violet-400/60 hover:bg-violet-500/15 disabled:opacity-40"
          >
            {isLoading ? <Spinner className="h-3 w-3" /> : '🔄'} Regen all
          </button>
        </div>
      </header>

      {error && (
        <p className="mb-3 rounded-xl border border-coral/30 bg-coral/10 px-4 py-2 text-xs text-coral">
          Couldn't generate variants ({error}). Try Regen all.
        </p>
      )}

      <div className="grid grid-cols-1 items-stretch gap-4 lg:grid-cols-3 xl:grid-cols-4">
        <div className="lg:col-span-3 xl:col-span-1">
          <CurrentPanel component={component} />
        </div>
        {slots.map((variant, i) =>
          isImage ? (
            <ImageVariantCard
              key={variant?.variantId ?? i}
              component={component}
              variant={variant}
              isSelected={!!variant && selected === variant.variantId}
              anotherSelected={!!selected && variant?.variantId !== selected}
              isLoading={isLoading}
              isRegenerating={!!variant && !!img.variantLoading[`${id}:${variant.variantId}`]}
              prompt={variant ? img.promptFor(id, variant.variantId) : ''}
              onSelect={() => img.select(id, variant.variantId)}
              onPromptChange={(value) => img.setDraft(id, variant.variantId, value)}
              onRegenerate={() => img.regenerateVariant(id, variant.variantId)}
              onUpload={(file) => img.upload(id, variant.variantId, file)}
            />
          ) : (
            <TextVariantCard
              key={variant?.variantId ?? i}
              component={component}
              variant={variant}
              isSelected={!!variant && selected === variant.variantId}
              anotherSelected={!!selected && variant?.variantId !== selected}
              editedContent={text.edits[id]}
              isLoading={isLoading}
              onSelect={() => selectText(variant.variantId)}
              onEdit={(value) => text.edit(id, value)}
            />
          ),
        )}
      </div>
    </section>
  )
}
