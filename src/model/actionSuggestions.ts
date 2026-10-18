// Quick choices for "what are you doing with this Action / Bonus Action / Reaction / Concentration?"
// The player can always type something else instead.
import type { ActionKind } from '../rules'
import { findLimitedFeature, type Activation } from '../rules/srd/limitedFeatures'
import { actionKindFor } from './castSpell'
import type { Character } from './character'
import { findSpellByName, type SrdSpell } from './spells'

/** The standard actions anyone can take (2024 rules). */
export const STANDARD_ACTIONS = ['Attack', 'Magic', 'Dash', 'Disengage', 'Dodge', 'Help', 'Hide', 'Influence', 'Ready', 'Search', 'Study', 'Utilize'] as const

const COMMON: Record<ActionKind, string[]> = {
  action: [...STANDARD_ACTIONS],
  bonusAction: ['Off-hand Attack (Light weapon)'],
  reaction: ['Opportunity Attack', 'Readied action'],
}

export type SuggestionKind = ActionKind | 'concentration'

/** Which buttons a feature from the catalog belongs under. 'Free' takes no action; 'Special' depends on the option. */
const ACTIVATION_KINDS: Record<Activation, ActionKind[]> = {
  Action: ['action'],
  'Magic action': ['action'],
  'Bonus Action': ['bonusAction'],
  Reaction: ['reaction'],
  Free: [],
  Special: ['action', 'bonusAction', 'reaction'],
}

/** Pools marked 'Free' in the catalog whose main uses still take a Bonus Action (Flurry of Blows…, creating a spell slot). */
const BONUS_ACTION_POOLS = new Set(['monk-monks-focus', 'sorcerer-font-of-magic'])

const featureKinds = (id: string, activation: Activation): ActionKind[] =>
  BONUS_ACTION_POOLS.has(id) ? ['bonusAction'] : ACTIVATION_KINDS[activation]

type SpellInfo = Pick<SrdSpell, 'name' | 'castingTime' | 'concentration'>

/**
 * Suggestions for a kind of action, most specific first: this character's attacks (for Action),
 * its spells, its limited-use features, then the common choices. No duplicates.
 *
 * Only what fits the button is offered, so a player isn't led to think a spell is a Bonus Action:
 * - spells by their SRD casting time (`srdSpells`); cantrips and prepared spells only.
 *   Spells not in the SRD (or while the SRD list is still loading) count as an Action.
 * - Concentration: only spells that need it (unknown spells stay, we can't tell).
 * - features by their catalog activation; features not from the catalog count as an Action.
 */
export function actionSuggestions(
  kind: SuggestionKind,
  c: Pick<Character, 'attacks' | 'spells' | 'features'> | null,
  srdSpells: SpellInfo[] | null = null,
): string[] {
  const attacks = kind === 'action' ? (c?.attacks ?? []).filter((a) => a.name).map((a) => `Attack: ${a.name}`) : []
  const spells = (c?.spells ?? [])
    .filter((s) => s.name && (s.level === 0 || s.prepared))
    .filter((s) => {
      const info = srdSpells ? findSpellByName(srdSpells as SrdSpell[], s.name) : undefined
      if (kind === 'concentration') return !info || info.concentration
      return (info ? actionKindFor(info.castingTime) : 'action') === kind
    })
    .map((s) => (kind === 'concentration' ? s.name : `Magic: ${s.name}`))
  const features = kind === 'concentration' ? [] : (c?.features ?? [])
    .filter((f) => {
      if (!f.name) return false
      const srd = f.srdId ? findLimitedFeature(f.srdId) : undefined
      return srd ? featureKinds(srd.id, srd.activation).includes(kind) : kind === 'action'
    })
    .map((f) => f.name)
  const common = kind === 'concentration' ? [] : COMMON[kind]
  return [...new Set([...attacks, ...spells, ...features, ...common])]
}

/** Clean a typed or picked description for the log. */
export function cleanDetail(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 100)
}
