// The limited-use feature catalog on the sheet: add SRD features (like adding spells), keep their uses in
// step with level and ability scores, and plan what using one costs. Pure functions; the screen saves.
import {
  availableFeatures, featureRecharge, featureUses, findLimitedFeature,
  type ActionKind, type Activation, type FeatureContext, type LimitedFeature,
} from '../rules'
import { newId, type Character } from './character'
import type { CharacterAction } from './characterActions'

const ctxOf = (c: Pick<Character, 'level' | 'scores'>): FeatureContext => ({ level: c.level, scores: c.scores })

/** Catalog features this character qualifies for that aren't on the sheet yet. */
export function featuresToAdd(c: Character): LimitedFeature[] {
  const have = new Set(c.features.map((f) => f.srdId).filter(Boolean))
  return availableFeatures(c).filter((f) => !have.has(f.id))
}

/** Add a catalog feature with its uses and recharge for this character. */
export function addCatalogFeature(c: Character, f: LimitedFeature): Character {
  if (c.features.some((x) => x.srdId === f.id)) return c
  const entry: Character['features'][number] = {
    id: newId(), name: f.name, max: featureUses(f, ctxOf(c)), used: 0, recharge: featureRecharge(f, c.level), srdId: f.id,
  }
  if (f.pool) entry.pool = true
  return { ...c, features: [...c.features, entry] }
}

/** Recalculate uses and recharge of catalog features (after a level-up or an ability score change). */
export function refreshCatalogFeatures(c: Character): Character {
  let changed = false
  const features = c.features.map((x) => {
    const f = x.srdId ? findLimitedFeature(x.srdId) : undefined
    if (!f) return x
    const max = featureUses(f, ctxOf(c))
    const recharge = featureRecharge(f, c.level)
    if (max === x.max && recharge === x.recharge) return x
    changed = true
    return { ...x, max, recharge, used: Math.min(x.used, max) }
  })
  return changed ? { ...c, features } : c
}

const KIND: Partial<Record<Activation, ActionKind>> = {
  Action: 'action', 'Magic action': 'action', 'Bonus Action': 'bonusAction', Reaction: 'reaction',
}

export interface UsePlan {
  actions: CharacterAction[]
  /** Fine to go ahead but worth knowing. */
  warnings: string[]
  error: string | null
}

/**
 * What using a feature does: spend one use (or `amount` pool points), tick the Action / Bonus Action /
 * Reaction it takes, and for Action Surge get the Action back.
 */
export function planFeatureUse(c: Character, featureId: string, amount = 1): UsePlan {
  const x = c.features.find((f) => f.id === featureId)
  if (!x) return { actions: [], warnings: [], error: 'ไม่พบความสามารถนี้' }
  const left = x.max - x.used
  const n = x.pool ? Math.max(1, Math.floor(amount)) : 1
  if (left < n) return { actions: [], warnings: [], error: `เหลือ ${left}/${x.max} ไม่พอ` }
  const f = x.srdId ? findLimitedFeature(x.srdId) : undefined
  if (f?.extraAction) return { actions: [{ type: 'actionSurge', featureId }], warnings: [], error: null }

  // The Action first (as with casting): a player out of turn is refused before the use is spent.
  const actions: CharacterAction[] = []
  const warnings: string[] = []
  const kind = f ? KIND[f.activation] : undefined
  if (kind) {
    if (c.turn[kind]) warnings.push(`${kind === 'bonusAction' ? 'Bonus Action' : kind === 'reaction' ? 'Reaction' : 'Action'} ของเทิร์นนี้ใช้ไปแล้ว`)
    else actions.push({ type: 'setActionUsed', kind, used: true, detail: f!.name })
  }
  actions.push({ type: 'setFeatureUsed', featureId, used: x.used + n })
  return { actions, warnings, error: null }
}

/** The SRD details of a sheet feature, for its card: summary, dice, activation. */
export function featureDetails(c: Character, srdId: string | undefined) {
  const f = srdId ? findLimitedFeature(srdId) : undefined
  if (!f) return null
  const ctx = ctxOf(c)
  return { feature: f, summary: f.summary(ctx), roll: f.roll?.(ctx) ?? null }
}

/** For the picker: the number of uses this character would get, as text. */
export function usesLabel(c: Character, f: LimitedFeature): string {
  const n = featureUses(f, ctxOf(c))
  const r = featureRecharge(f, c.level)
  const when = r === 'long' ? 'Long Rest' : r === 'short' ? 'Short/Long Rest' : 'Short +1 / Long Rest'
  return `${f.pool ? `${n} แต้ม` : `${n} ครั้ง`} · ${when}`
}

/** Add every catalog feature the character qualifies for (a new character from the wizard). */
export function withAllCatalogFeatures(c: Character): Character {
  return featuresToAdd(c).reduce(addCatalogFeature, c)
}

/**
 * After an edit (level-up, new subclass, species or feat): add the catalog features that just became
 * available. Ones that were already available but aren't on the sheet were left out on purpose: not re-added.
 */
export function addNewlyAvailable(before: Character, after: Character): Character {
  const had = new Set(availableFeatures(before).map((f) => f.id))
  return featuresToAdd(after).filter((f) => !had.has(f.id)).reduce(addCatalogFeature, after)
}
