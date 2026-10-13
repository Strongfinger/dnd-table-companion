// A character's feats by slot (background, Human Versatile, Fighting Style, Ability Score Improvement levels,
// Epic Boon), with the ability increases each pick applied, so a pick can be changed or removed and its
// increase is taken back. `feats` (names) stays the list the rest of the app reads; it is rebuilt from the picks.
// Feats outside the SRD (e.g. from the Player's Handbook) can be typed into any slot (owner decision 2026-10-13).
import { ABILITIES, featSlots, findSrdFeat, hasFightingStyleFeature, type Ability, type FeatSlot } from '../rules'
import type { Character, FeatPick } from './character'

/** Picks for every feat on the sheet. Older sheets (names only) get their feats placed into slots once. */
export function featPicksOf(c: Pick<Character, 'feats' | 'featPicks' | 'className' | 'subclass' | 'level' | 'species' | 'background'>): FeatPick[] {
  if (c.featPicks) return c.featPicks
  const slots = featSlots(c)
  const free = [...slots]
  const take = (pred: (s: FeatSlot) => boolean) => {
    const i = free.findIndex(pred)
    return i >= 0 ? free.splice(i, 1)[0] : undefined
  }
  return c.feats.map((name, n) => {
    const srd = findSrdFeat(name)
    const slot =
      (srd?.category === 'Origin' && (take((s) => s.id === 'background') ?? take((s) => s.id === 'species'))) ||
      (srd?.category === 'Fighting Style' && take((s) => s.kind === 'fightingStyle')) ||
      (srd?.category === 'Epic Boon' && take((s) => s.kind === 'epicBoon')) ||
      take((s) => s.kind === 'asi') ||
      undefined
    return { slot: slot?.id ?? `extra-${n}`, feat: name }
  })
}

const addScores = (scores: Character['scores'], inc: FeatPick['increase'], sign: 1 | -1) => {
  if (!inc) return scores
  const out = { ...scores }
  for (const a of ABILITIES) if (inc[a]) out[a] = Math.max(1, out[a] + sign * inc[a]!)
  return out
}

/** The part of an increase that fits under the feat's maximum (20, or 30 for Epic Boons and typed feats). */
function appliedIncrease(feat: string, inc: FeatPick['increase'], scores: Character['scores']): FeatPick['increase'] {
  if (!inc) return undefined
  const max = findSrdFeat(feat)?.increase?.max ?? 30
  const out: Partial<Record<Ability, number>> = {}
  for (const a of ABILITIES) {
    const n = Math.min(inc[a] ?? 0, Math.max(0, max - scores[a]))
    if (n > 0) out[a] = n
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Put a feat in a slot (null = empty it). The old pick's ability increase is taken back and the new one added.
 * Alert also turns the Initiative proficiency on/off, as the edit page did.
 */
export function setFeatPick(c: Character, slot: string, feat: string | null, increase?: FeatPick['increase']): Character {
  const picks = featPicksOf(c)
  const old = picks.find((p) => p.slot === slot)
  let scores = addScores(c.scores, old?.increase, -1)
  const rest = picks.filter((p) => p.slot !== slot)
  const name = feat?.trim()
  const featName = name ? findSrdFeat(name)?.name ?? name : ''
  // Only what fits under the maximum is added (and recorded), so taking the pick back is exact.
  const applied = name ? appliedIncrease(featName, increase, scores) : undefined
  const pick: FeatPick | null = name ? { slot, feat: featName, ...(applied ? { increase: applied } : {}) } : null
  if (pick) scores = addScores(scores, pick.increase, 1)
  const featPicks = pick ? [...rest, pick] : rest
  const feats = featPicks.map((p) => p.feat)
  const hadAlert = c.feats.includes('Alert')
  const hasAlert = feats.includes('Alert')
  return {
    ...c,
    scores,
    featPicks,
    feats,
    initiativeProficient: hasAlert ? true : hadAlert ? false : c.initiativeProficient,
  }
}

/** Check an ability increase against the feat's rule: how many points, which abilities, the maximum score. */
export function increaseProblem(featName: string, inc: FeatPick['increase'], scoresBefore: Character['scores']): string | null {
  const rule = findSrdFeat(featName)?.increase
  if (!rule) return null
  const entries = Object.entries(inc ?? {}).filter(([, v]) => v) as [Ability, number][]
  const total = entries.reduce((n, [, v]) => n + v, 0)
  if (total !== rule.points) return `${featName}: เพิ่มได้รวม ${rule.points} แต้ม`
  if (!rule.split && entries.length > 1) return `${featName}: เพิ่มได้ค่าเดียว`
  if (entries.some(([a]) => !rule.abilities.includes(a))) return `${featName}: เพิ่มได้เฉพาะ ${rule.abilities.map((a) => a.toUpperCase()).join('/')}`
  if (entries.some(([a, v]) => scoresBefore[a] + v > rule.max)) return `${featName}: ค่า Ability สูงสุด ${rule.max}`
  return null
}

export interface FeatSlotView {
  slot: FeatSlot
  pick: FeatPick | null
}

/** Each slot with its pick, plus picks that don't fit a slot (e.g. after the level went down). */
export function featSlotViews(c: Character): { slots: FeatSlotView[]; extra: FeatPick[] } {
  const picks = featPicksOf(c)
  const slots = featSlots(c).map((slot) => ({ slot, pick: picks.find((p) => p.slot === slot.id) ?? null }))
  const extra = picks.filter((p) => !slots.some((s) => s.slot.id === p.slot))
  return { slots, extra }
}

/** Warnings (never blocking): empty slots, a non-repeatable feat twice, a feat in the wrong kind of slot. */
export function featWarnings(c: Character): string[] {
  const { slots } = featSlotViews(c)
  const out: string[] = []
  for (const { slot, pick } of slots) if (!pick) out.push(`ยังไม่ได้เลือก: ${slot.label}`)
  const picks = featPicksOf(c)
  for (const p of picks) {
    const srd = findSrdFeat(p.feat)
    if (srd && !srd.repeatable && picks.filter((x) => x.feat === p.feat).length > 1 && picks.find((x) => x.feat === p.feat) === p) out.push(`${p.feat} เลือกซ้ำไม่ได้`)
    const slot = slots.find((s) => s.slot.id === p.slot)?.slot
    if (srd && slot?.kind === 'origin' && srd.category !== 'Origin') out.push(`${p.feat} ไม่ใช่ Origin Feat`)
    if (srd && slot?.kind === 'fightingStyle' && srd.category !== 'Fighting Style') out.push(`${p.feat} ไม่ใช่ Fighting Style Feat`)
    if (srd?.category === 'Epic Boon' && c.level < 19) out.push(`${p.feat}: ต้อง Level 19+`)
    if (srd?.category === 'General' && c.level < 4) out.push(`${p.feat}: ต้อง Level 4+`)
    if (srd?.category === 'Fighting Style' && !hasFightingStyleFeature(c.className)) out.push(`${p.feat}: ต้องมี Fighting Style ของ Class`)
    if (srd?.name === 'Grappler' && c.scores.str - (p.increase?.str ?? 0) < 13 && c.scores.dex - (p.increase?.dex ?? 0) < 13) out.push('Grappler: ต้องมี STR หรือ DEX 13+')
    if (srd?.name === 'Boon of Spell Recall' && !c.spellcastingAbility) out.push('Boon of Spell Recall: ต้องมี Spellcasting')
  }
  return out
}
