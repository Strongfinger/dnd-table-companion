// Quick choices for "what are you doing with this Action / Bonus Action / Reaction / Concentration?"
// The player can always type something else instead.
import type { ActionKind } from '../rules'
import type { Character } from './character'

/** The standard actions anyone can take (2024 rules). */
export const STANDARD_ACTIONS = ['Attack', 'Magic', 'Dash', 'Disengage', 'Dodge', 'Help', 'Hide', 'Influence', 'Ready', 'Search', 'Study', 'Utilize'] as const

const COMMON: Record<ActionKind, string[]> = {
  action: [...STANDARD_ACTIONS],
  bonusAction: ['Off-hand Attack (Light weapon)'],
  reaction: ['Opportunity Attack', 'Readied action'],
}

export type SuggestionKind = ActionKind | 'concentration'

/**
 * Suggestions for a kind of action, most specific first: this character's attacks (for Action),
 * its spells, its limited-use features, then the common choices. No duplicates.
 */
export function actionSuggestions(kind: SuggestionKind, c: Pick<Character, 'attacks' | 'spells' | 'features'> | null): string[] {
  const attacks = kind === 'action' ? (c?.attacks ?? []).filter((a) => a.name).map((a) => `Attack: ${a.name}`) : []
  const spells = (c?.spells ?? []).filter((s) => s.name).map((s) => (kind === 'concentration' ? s.name : `Magic: ${s.name}`))
  const features = kind === 'concentration' ? [] : (c?.features ?? []).filter((f) => f.name).map((f) => f.name)
  const common = kind === 'concentration' ? [] : COMMON[kind]
  return [...new Set([...attacks, ...spells, ...features, ...common])]
}

/** Clean a typed or picked description for the log. */
export function cleanDetail(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 100)
}
