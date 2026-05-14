import { useNavigate, useParams } from 'react-router-dom'
import type { NavigateOptions } from 'react-router-dom'

/**
 * Wraps useNavigate to auto-prepend the current /:brandSlug prefix.
 * Pass paths starting with '/' — they become /:brandSlug/path.
 *
 * For absolute navigation outside the brand scope (e.g. brand picker),
 * use useNavigate() directly.
 */
export function useBrandNavigate() {
  const navigate = useNavigate()
  const { brandSlug } = useParams<{ brandSlug: string }>()

  return (path: string | number, options?: NavigateOptions) => {
    if (typeof path === 'number') {
      navigate(path)
      return
    }
    navigate(`/${brandSlug}${path}`, options)
  }
}

/**
 * Returns a brand-prefixed path string for use in <Link to={...}> or hrefs.
 */
export function useBrandPath(path: string): string {
  const { brandSlug } = useParams<{ brandSlug: string }>()
  return `/${brandSlug}${path}`
}
