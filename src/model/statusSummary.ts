// What the HP box shows at a glance: the statuses on a character right now, and what an HP change will do.
// Pure helpers for HpCard.tsx; the rules themselves live in src/rules/play.ts.
import { applyDamage, gainTempHp, heal } from '../rules'
import type { Character } from './character'
import { buffModsText } from './characterActions'
import { equippedMagicEffects } from './inventory'
import { CONDITION_TH } from './thai'

export type StatusKind = 'condition' | 'exhaustion' | 'concentration' | 'buff' | 'magic'

export interface StatusChip {
  kind: StatusKind
  /** Short text on the chip, e.g. "Prone ล้มลง" or "Longstrider Speed +10 ft.". */
  label: string
  /** Glossary term for the long-press help (conditions, Exhaustion, Concentration). */
  term?: string
}

/**
 * Everything active on a character, most urgent first: conditions, Exhaustion, Concentration,
 * temporary buffs, then effects of equipped magic items.
 */
export function activeStatuses(c: Pick<Character, 'conditions' | 'exhaustion' | 'concentration' | 'buffs' | 'inventory'>): StatusChip[] {
  const chips: StatusChip[] = c.conditions.map((cond) => ({ kind: 'condition', label: `${cond} ${CONDITION_TH[cond] ?? ''}`.trim(), term: cond }))
  if (c.exhaustion > 0) chips.push({ kind: 'exhaustion', label: `Exhaustion ${c.exhaustion}`, term: 'Exhaustion' })
  if (c.concentration) chips.push({ kind: 'concentration', label: `Concentration: ${c.concentration}`, term: 'Concentration' })
  for (const b of c.buffs ?? []) {
    const mods = buffModsText(b)
    chips.push({ kind: 'buff', label: mods ? `${b.name} ${mods}` : b.name })
  }
  for (const e of equippedMagicEffects(c)) chips.push({ kind: 'magic', label: e.name })
  return chips
}

export type HpChange = 'damage' | 'heal' | 'temp'

/** One line showing what an HP change will do before it is saved, e.g. "15 → 10 HP" or "Temp 0 → 5". */
export function hpChangePreview(c: Pick<Character, 'hp' | 'deathSaves'>, change: HpChange, amount: number, critical = false): string {
  const n = Math.max(0, Math.floor(amount) || 0)
  const state = { hp: c.hp, deathSaves: c.deathSaves }
  if (change === 'temp') {
    const after = gainTempHp(state, n).hp.temp
    return after === c.hp.temp && n > 0 ? `Temp ${c.hp.temp} อยู่แล้ว (Temp HP ไม่ซ้อนกัน เก็บค่าที่มากกว่า)` : `Temp HP ${c.hp.temp} → ${after}`
  }
  if (change === 'heal') return `${c.hp.current} → ${heal(state, n).hp.current} / ${c.hp.max} HP`
  const r = applyDamage(state, n, critical)
  const temp = c.hp.temp > 0 ? ` · Temp ${c.hp.temp} → ${r.hp.temp}` : ''
  const atZero = c.hp.current === 0 && n > c.hp.temp
    ? ` · Death Save ล้มเหลว ${r.deathSaves.failures}/3`
    : ''
  const fallen = r.dead ? ' · 💀 ตาย' : r.droppedToZero ? ' · ล้มลง 0 HP' : ''
  return `${c.hp.current} → ${r.hp.current} / ${c.hp.max} HP${temp}${atZero}${fallen}`
}
