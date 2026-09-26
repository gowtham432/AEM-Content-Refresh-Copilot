import { useCallback, useRef, useState } from 'react'

async function errorMessage(res) {
  return (await res.json().catch(() => null))?.detail || `Server returned ${res.status}`
}

// Per image component: the AI image, the prompt behind it, and a status:
// 'original' | 'ai' | 'custom' (user-edited prompt) | 'uploaded' (user's own file).
export function useGenerateImage() {
  const [images, setImages] = useState({}) // id -> { url, prompt, autoPrompt, status }
  const [drafts, setDrafts] = useState({}) // id -> prompt text currently in the editor
  const [loadingIds, setLoadingIds] = useState({})
  const [errors, setErrors] = useState({})
  const runRef = useRef(0) // bumped on reset so stale responses are dropped

  const reset = useCallback(() => {
    runRef.current += 1
    setImages({})
    setDrafts({})
    setLoadingIds({})
    setErrors({})
  }, [])

  const setLoading = (id, value) => setLoadingIds((prev) => ({ ...prev, [id]: value }))
  const setError = (id, value) => setErrors((prev) => ({ ...prev, [id]: value }))

  // No prompt = the backend writes a fresh on-brand one from the image's context.
  const generateOne = useCallback(async (comp, prompt) => {
    const run = runRef.current
    setLoading(comp.id, true)
    setError(comp.id, null)
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          componentId: comp.id,
          prompt: prompt || null,
          imageContext: comp.imageContext || '',
          altText: comp.altText || '',
        }),
      })
      if (!res.ok) throw new Error(await errorMessage(res))
      const data = await res.json()
      if (run !== runRef.current) return
      setImages((prev) => {
        const autoPrompt = prompt ? prev[comp.id]?.autoPrompt : data.promptUsed
        const isCustom = prompt && prompt.trim() !== autoPrompt
        return {
          ...prev,
          [comp.id]: {
            url: data.generatedImageUrl,
            prompt: data.promptUsed,
            autoPrompt,
            status: isCustom ? 'custom' : 'ai',
          },
        }
      })
      setDrafts((prev) => ({ ...prev, [comp.id]: data.promptUsed }))
    } catch (e) {
      if (run === runRef.current) setError(comp.id, e.message)
    } finally {
      if (run === runRef.current) setLoading(comp.id, false)
    }
  }, [])

  const generate = useCallback((comps) => Promise.all(comps.map((c) => generateOne(c))), [generateOne])

  const setDraft = useCallback((id, text) => setDrafts((prev) => ({ ...prev, [id]: text })), [])

  const upload = useCallback(async (comp, file) => {
    const run = runRef.current
    setLoading(comp.id, true)
    setError(comp.id, null)
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('Could not read the file'))
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ componentId: comp.id, dataUrl }),
      })
      if (!res.ok) throw new Error(await errorMessage(res))
      const data = await res.json()
      if (run !== runRef.current) return
      setImages((prev) => ({
        ...prev,
        [comp.id]: { ...prev[comp.id], url: data.generatedImageUrl, status: 'uploaded' },
      }))
    } catch (e) {
      if (run === runRef.current) setError(comp.id, e.message)
    } finally {
      if (run === runRef.current) setLoading(comp.id, false)
    }
  }, [])

  return { images, drafts, loadingIds, errors, generate, generateOne, setDraft, upload, reset }
}
