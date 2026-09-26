import { useEffect, useState } from 'react'

const DEBOUNCE_MS = 2000
const MIN_CHARS = 20

// Debounced Gemini suggestions on the user's draft. Only runs while `enabled`
// (i.e. the user has edited the draft themselves).
export function useSuggest(componentType, originalContent, userDraft, enabled) {
  const [suggestions, setSuggestions] = useState([])
  const [isLoadingSuggestions, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled || (userDraft || '').trim().length < MIN_CHARS) {
      setSuggestions([])
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsLoading(true)
      try {
        const res = await fetch('/api/suggest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ componentType, originalContent, userDraft }),
          signal: controller.signal,
        })
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        setSuggestions((await res.json()).suggestions || [])
        setIsLoading(false)
      } catch (e) {
        if (e.name === 'AbortError') return
        setSuggestions([])
        setIsLoading(false)
      }
    }, DEBOUNCE_MS)

    // A new keystroke (or unmount) cancels both the pending timer and any in-flight request.
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [componentType, originalContent, userDraft, enabled])

  return { suggestions, isLoadingSuggestions }
}
