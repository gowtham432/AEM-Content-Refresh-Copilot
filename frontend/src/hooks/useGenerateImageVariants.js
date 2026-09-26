import { useCallback, useRef, useState } from 'react'

const setMany = (setter, ids, value) =>
  setter((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, value])) }))

const errorMessage = async (res) => (await res.json().catch(() => null))?.detail || `Server returned ${res.status}`
const keyOf = (id, variantId) => `${id}:${variantId}`

// Three styled AI images per image component, one selected variant, and per-variant
// prompt editing / regeneration / upload.
export function useGenerateImageVariants() {
  const [variants, setVariants] = useState({}) // id -> [{ variantId, label, color, generatedImageUrl, promptUsed, error }]
  const [selected, setSelected] = useState({}) // id -> variantId | null
  const [drafts, setDrafts] = useState({}) // "id:variant" -> prompt being edited
  const [variantLoading, setVariantLoading] = useState({}) // "id:variant" -> true while re-rendering
  const [loadingIds, setLoadingIds] = useState({})
  const [errors, setErrors] = useState({})
  const runRef = useRef(0)

  const reset = useCallback(() => {
    runRef.current += 1
    setVariants({})
    setSelected({})
    setDrafts({})
    setVariantLoading({})
    setLoadingIds({})
    setErrors({})
  }, [])

  const patchVariant = (id, variantId, patch) =>
    setVariants((prev) => ({
      ...prev,
      [id]: (prev[id] || []).map((v) => (v.variantId === variantId ? { ...v, ...patch } : v)),
    }))

  // Also serves "Regen All".
  const generate = useCallback(async (components) => {
    if (!components.length) return
    const run = runRef.current
    const ids = components.map((c) => c.id)
    setMany(setLoadingIds, ids, true)
    setMany(setErrors, ids, null)
    try {
      const res = await fetch('/api/generate-image-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          components: components.map(({ id, imageContext, altText }) => ({ id, imageContext, altText })),
        }),
      })
      if (!res.ok) throw new Error(await errorMessage(res))
      const { results } = await res.json()
      if (run !== runRef.current) return
      setVariants((prev) => ({ ...prev, ...Object.fromEntries(results.map((r) => [r.id, r.variants])) }))
      setMany(setSelected, ids, null)
      setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([k]) => !ids.includes(k.split(':')[0]))))
    } catch (e) {
      if (run === runRef.current) setMany(setErrors, ids, e.message)
    } finally {
      if (run === runRef.current) setMany(setLoadingIds, ids, false)
    }
  }, [])

  const select = useCallback((id, variantId) => setSelected((prev) => ({ ...prev, [id]: variantId })), [])

  const promptFor = (id, variantId) =>
    drafts[keyOf(id, variantId)] ?? variants[id]?.find((v) => v.variantId === variantId)?.promptUsed ?? ''

  const setDraft = useCallback(
    (id, variantId, text) => setDrafts((prev) => ({ ...prev, [keyOf(id, variantId)]: text })),
    [],
  )

  const runVariantRequest = useCallback(async (id, variantId, request) => {
    const run = runRef.current
    const key = keyOf(id, variantId)
    setVariantLoading((prev) => ({ ...prev, [key]: true }))
    try {
      const res = await request()
      if (!res.ok) throw new Error(await errorMessage(res))
      const data = await res.json()
      if (run !== runRef.current) return
      patchVariant(id, variantId, { generatedImageUrl: data.generatedImageUrl, error: null, ...(data.promptUsed && { promptUsed: data.promptUsed }) })
      setDrafts((prev) => {
        const { [key]: _dropped, ...rest } = prev
        return rest
      })
    } catch (e) {
      if (run === runRef.current) patchVariant(id, variantId, { error: e.message })
    } finally {
      if (run === runRef.current) setVariantLoading((prev) => ({ ...prev, [key]: false }))
    }
  }, [])

  // Re-render one variant from the (possibly edited) prompt.
  const regenerateVariant = useCallback(
    (id, variantId) =>
      runVariantRequest(id, variantId, () =>
        fetch('/api/regenerate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ componentId: id, variantId, prompt: promptFor(id, variantId) }),
        }),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [drafts, variants, runVariantRequest],
  )

  // Swap the selected variant's image for the user's own file.
  const upload = useCallback(
    async (id, variantId, file) => {
      let dataUrl
      try {
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result)
          reader.onerror = () => reject(new Error('Could not read the file'))
          reader.readAsDataURL(file)
        })
      } catch (e) {
        patchVariant(id, variantId, { error: e.message })
        return
      }
      await runVariantRequest(id, variantId, () =>
        fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ componentId: id, dataUrl }),
        }),
      )
    },
    [runVariantRequest],
  )

  const urlFor = useCallback(
    (id) => variants[id]?.find((v) => v.variantId === selected[id])?.generatedImageUrl ?? null,
    [variants, selected],
  )

  return {
    variants,
    selected,
    variantLoading,
    loadingIds,
    errors,
    generate,
    select,
    promptFor,
    setDraft,
    regenerateVariant,
    upload,
    urlFor,
    reset,
  }
}
