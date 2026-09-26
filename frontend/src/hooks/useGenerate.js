import { useCallback, useRef, useState } from 'react'

// Holds the right-hand (refreshed) content for every component, plus its status:
// 'original' | 'ai' | 'edited'.
export function useGenerate() {
  const [contents, setContents] = useState({})
  const [statuses, setStatuses] = useState({})
  const [loadingIds, setLoadingIds] = useState({})
  const [errors, setErrors] = useState({})
  const runRef = useRef(0) // bumped on reset so stale responses are dropped

  const reset = useCallback(() => {
    runRef.current += 1
    setContents({})
    setStatuses({})
    setLoadingIds({})
    setErrors({})
  }, [])

  const generate = useCallback(async (components) => {
    if (!components.length) return
    const run = runRef.current
    const ids = components.map((c) => c.id)
    setLoadingIds((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, true])) }))
    setErrors((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, null])) }))

    let results
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          components: components.map(({ id, type, currentContent }) => ({ id, type, currentContent })),
        }),
      })
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      results = (await res.json()).results
    } catch (e) {
      if (run !== runRef.current) return
      setLoadingIds((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, false])) }))
      setErrors((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, e.message])) }))
      return
    }
    if (run !== runRef.current) return

    const byId = Object.fromEntries(results.map((r) => [r.id, r]))
    setContents((prev) => {
      const next = { ...prev }
      for (const c of components) {
        const text = byId[c.id]?.generatedContent
        if (text) next[c.id] = text
      }
      return next
    })
    setStatuses((prev) => {
      const next = { ...prev }
      for (const c of components) if (byId[c.id]?.generatedContent) next[c.id] = 'ai'
      return next
    })
    setErrors((prev) => {
      const next = { ...prev }
      for (const c of components) {
        next[c.id] = byId[c.id]?.generatedContent ? null : byId[c.id]?.error || 'Generation failed'
      }
      return next
    })
    setLoadingIds((prev) => ({ ...prev, ...Object.fromEntries(ids.map((id) => [id, false])) }))
  }, [])

  const edit = useCallback((id, text) => {
    setContents((prev) => ({ ...prev, [id]: text }))
    setStatuses((prev) => ({ ...prev, [id]: 'edited' }))
  }, [])

  return { contents, statuses, loadingIds, errors, generate, reset, edit }
}
