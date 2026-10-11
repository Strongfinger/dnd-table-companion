// Tiny hash router: the page part after "#" picks the screen, e.g. #/c/<id>/edit.
// Hash URLs work on any static host (Vercel) and offline, with no server config.
import { useEffect, useState } from 'react'

export type Route =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'import' }
  | { name: 'sheet'; id: string }
  | { name: 'edit'; id: string }

export function parseRoute(hash: string): Route {
  const [first, id, action] = hash.replace(/^#\/?/, '').split('/')
  if (first === 'new') return { name: 'new' }
  if (first === 'import') return { name: 'import' }
  if (first === 'c' && id) return action === 'edit' ? { name: 'edit', id } : { name: 'sheet', id }
  return { name: 'list' }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash))
  useEffect(() => {
    const onChange = () => {
      setRoute(parseRoute(window.location.hash))
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

/** Go to a screen, e.g. go('/c/123'). */
export function go(path: string): void {
  window.location.hash = path
}
