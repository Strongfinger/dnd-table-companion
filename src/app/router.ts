// Tiny hash router: the page part after "#" picks the screen, e.g. #/c/<id>/edit.
// Hash URLs work on any static host (Vercel) and offline, with no server config.
import { useEffect, useState } from 'react'

export type Route =
  | { name: 'list' }
  | { name: 'new' }
  | { name: 'import' }
  | { name: 'fights' }
  | { name: 'about' }
  | { name: 'party' }
  | { name: 'lab' }
  /** `code`: filled in from a QR / join link (#/lobby/K7QX4M). */
  | { name: 'lobby'; code: string | null }
  /** The DM's tools: notes, generators, lookup. */
  | { name: 'dm' }
  | { name: 'note'; id: string }
  /** Import a campaign pack (prepared pages, session plans, fights). */
  | { name: 'packImport' }
  /** SRD lookup: #/lookup, #/lookup/monsters, #/lookup/spells, #/lookup/rules */
  | { name: 'lookup'; tab: 'monsters' | 'spells' | 'rules' | null }
  | { name: 'monster'; id: string }
  | { name: 'spell'; id: string }
  | { name: 'fight'; id: string }
  | { name: 'sheet'; id: string }
  | { name: 'edit'; id: string }

export function parseRoute(hash: string): Route {
  const [first, id, action] = hash.replace(/^#\/?/, '').split('/')
  if (first === 'new') return { name: 'new' }
  if (first === 'import') return { name: 'import' }
  if (first === 'fights') return { name: 'fights' }
  if (first === 'about') return { name: 'about' }
  if (first === 'party') return { name: 'party' }
  if (first === 'lab') return { name: 'lab' }
  if (first === 'lobby') return { name: 'lobby', code: id ?? null }
  if (first === 'lookup') {
    if (id === 'monster' && action) return { name: 'monster', id: action }
    if (id === 'spell' && action) return { name: 'spell', id: action }
    return { name: 'lookup', tab: id === 'monsters' || id === 'spells' || id === 'rules' ? id : null }
  }
  if (first === 'dm') {
    if (id === 'note' && action) return { name: 'note', id: action }
    return id === 'import' ? { name: 'packImport' } : { name: 'dm' }
  }
  if (first === 'fight' && id) return { name: 'fight', id }
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
