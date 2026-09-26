import { useCallback, useRef, useState } from 'react'

const setMany = (setter, ids, value) =>
  setter((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, value])) }))

// Three AI variants per text component, one selected variant (which becomes editable),
// and the user's edits on it.
export function useGenerateTextVariants() {
  const [variants, setVariants] = useState({}) // id -> [{ variantId, label, model, color, generatedContent, error }]
  const [selected, setSelected] = useState({}) // id -> variantId | null
  const [edits, setEdits] = useState({}) // id -> user-edited text (absent = untouched)
  const [loadingIds, setLoadingIds] = useState({})
  const [errors, setErrors] = useState({})
  const runRef = useRef(0) // bumped on reset so stale responses are dropped

  const reset = useCallback(() => {
    runRef.current += 1
    setVariants({})
    setSelected({})
    setEdits({})
    setLoadingIds({})
    setErrors({})
  }, [])

  // Also serves "Regen All": fresh variants replace the old ones, selection and edits are cleared.
  const generate = useCallback(async (components) => {
    if (!components.length) return
    const run = runRef.current
    const ids = components.map((c) => c.id)
    setMany(setLoadingIds, ids, true)
    setMany(setErrors, ids, null)
    try {
      const res = await fetch('/api/generate-text-variants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          components: components.map(({ id, type, currentContent }) => ({ id, type, currentContent })),
        }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || `Server returned ${res.status}`)
      const { results } = await res.json()
      if (run !== runRef.current) return
      setVariants((prev) => ({ ...prev, ...Object.fromEntries(results.map((r) => [r.id, r.variants])) }))
      setMany(setSelected, ids, null)
      setEdits((prev) => Object.fromEntries(Object.entries(prev).filter(([id]) => !ids.includes(id))))
    } catch (e) {
      if (run === runRef.current) setMany(setErrors, ids, e.message)
    } finally {
      if (run === runRef.current) setMany(setLoadingIds, ids, false)
    }
  }, [])

  const select = useCallback((id, variantId) => {
    setSelected((prev) => ({ ...prev, [id]: variantId }))
    setEdits((prev) => {
      const { [id]: _dropped, ...rest } = prev // switching variants discards edits on the old one
      return rest
    })
  }, [])

  const edit = useCallback((id, text) => setEdits((prev) => ({ ...prev, [id]: text })), [])

  const contentFor = useCallback(
    (id) => edits[id] ?? variants[id]?.find((v) => v.variantId === selected[id])?.generatedContent ?? null,
    [edits, variants, selected],
  )

  return { variants, selected, edits, loadingIds, errors, generate, select, edit, contentFor, reset }
}
