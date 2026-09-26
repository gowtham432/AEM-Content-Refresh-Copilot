import { useCallback, useState } from 'react'

export function useFetchPage() {
  const [page, setPage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  // Resolves to the page data (or null on failure) so the caller can chain generation.
  const fetchPage = useCallback(async (path) => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/fetch-page?path=${encodeURIComponent(path)}`)
      if (!res.ok) throw new Error((await res.json().catch(() => null))?.detail || `Server returned ${res.status}`)
      const data = await res.json()
      setPage(data)
      return data
    } catch (e) {
      setError(e.message || 'Could not reach the backend')
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { fetchPage, page, isLoading, error }
}
