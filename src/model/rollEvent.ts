// A dice roll shared from a phone to the DM's fight log (future live lobby).
// `by` is filled from the sending device by the lobby, not trusted from the message.
import { canUseAdvantage, parseDice } from '../rules'
export interface RollEvent {
  type: 'roll'
  /** Who rolled: the character name shown in the log. */
  by: string
  expression: string
  mode: 'normal' | 'advantage' | 'disadvantage'
  critical: boolean
  total: number
  /** Die faces; null when typed in from real dice. */
  faces: number[][] | null
  natural: 20 | 1 | null
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Check a received roll and rebuild it with known fields only, or null. */
export function parseRollEvent(v: unknown): RollEvent | null {
  if (!isObj(v) || v.type !== 'roll') return null
  const { by, expression, mode, critical, total, faces, natural } = v
  if (typeof by !== 'string' || by.length > 60 || typeof expression !== 'string' || expression.length > 60) return null
  if (mode !== 'normal' && mode !== 'advantage' && mode !== 'disadvantage') return null
  if (typeof critical !== 'boolean' || !Number.isInteger(total) || Math.abs(total as number) > 100000) return null
  if (natural !== null && natural !== 20 && natural !== 1) return null
  const facesOk = faces === null || (Array.isArray(faces) && faces.length <= 20 &&
    faces.every((f) => Array.isArray(f) && f.length <= 200 && f.every((n) => Number.isInteger(n) && n >= 1 && n <= 1000)))
  if (!facesOk) return null
  // The expression must be real dice notation; a claimed natural 20/1 needs a single d20 roll.
  const e = parseDice(expression)
  if (!e) return null
  if (natural !== null && (!canUseAdvantage(e) || (faces !== null && !(faces as number[][])[0]?.includes(natural)))) return null
  return { type: 'roll', by, expression, mode, critical, total: total as number, faces: faces as number[][] | null, natural }
}

/** One log line, e.g. "🎲 Boom: 1d20+5 (Advantage) = 23". */
export function rollEventText(r: RollEvent): string {
  const extra = [r.mode !== 'normal' ? (r.mode === 'advantage' ? 'Advantage' : 'Disadvantage') : '', r.critical ? 'Critical' : '', r.faces ? '' : 'ทอยเอง']
    .filter(Boolean).join(', ')
  const nat = r.natural === 20 ? ' · Nat 20!' : r.natural === 1 ? ' · Nat 1' : ''
  return `🎲 ${r.by}: ${r.expression}${extra ? ` (${extra})` : ''} = ${r.total}${nat}`
}
