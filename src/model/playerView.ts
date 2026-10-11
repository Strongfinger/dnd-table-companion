// What players may see of a fight (sent to their phones in a future live lobby).
// DM secrets stay out: hidden creatures, monsters' exact HP and AC, monster concentration, notes.
import type { Character } from './character'
import { isConditionName, type Combatant, type Encounter } from './encounter'

export type HealthStatus = 'healthy' | 'hurt' | 'bloodied' | 'down'

export const HEALTH_LABEL: Record<HealthStatus, string> = {
  healthy: 'ไม่บาดเจ็บ',
  hurt: 'บาดเจ็บ',
  bloodied: 'Bloodied (บาดเจ็บหนัก)',
  down: 'ล้ม',
}

/** Rough health: full, hurt, Bloodied (2024: at or below half HP), or down. */
export function healthStatus(hp: { max: number; current: number }, defeated = false): HealthStatus {
  if (defeated || hp.current <= 0) return 'down'
  if (hp.current >= hp.max) return 'healthy'
  return hp.current * 2 <= hp.max ? 'bloodied' : 'hurt'
}

export interface PlayerCombatant {
  id: string
  name: string
  kind: 'pc' | 'monster'
  initiative: number | null
  active: boolean
  /** Visible conditions/effects (names and turns left). */
  effects: { name: string; rounds: number | null }[]
  /** Monsters: rough health only. */
  health: HealthStatus
  /** PCs only: the party sees each other's HP and the linked sheet id. */
  pc: { characterId: string; hp: { max: number; current: number; temp: number } } | null
}

export interface PlayerEncounterView {
  id: string
  name: string
  status: Encounter['status']
  round: number
  combatants: PlayerCombatant[]
  /** True when it's a hidden creature's turn: players just see "someone unseen is acting". */
  hiddenTurn: boolean
}

export function playerView(e: Encounter, characters: Map<string, Character>): PlayerEncounterView {
  const visible = e.combatants.filter((c) => !c.hidden)
  const active = e.combatants.find((c) => c.id === e.activeId)
  return {
    id: e.id,
    name: e.name,
    status: e.status,
    round: e.round,
    hiddenTurn: !!active?.hidden,
    combatants: visible.map((c) => toPlayer(c, e.activeId, characters)),
  }
}

function toPlayer(c: Combatant, activeId: string | null, characters: Map<string, Character>): PlayerCombatant {
  const sheet = c.kind === 'pc' && c.characterId ? characters.get(c.characterId) : undefined
  const hp = sheet ? sheet.hp : c.hp
  return {
    id: c.id,
    name: c.name,
    kind: c.kind,
    initiative: c.initiative,
    active: c.id === activeId,
    // Monsters: only real conditions (Prone, Frightened…); custom DM notes like "Charmed by Strahd" stay secret.
    effects: c.effects.filter((ef) => c.kind === 'pc' || isConditionName(ef.name)).map((ef) => ({ name: ef.name, rounds: ef.rounds })),
    health: healthStatus(hp, c.defeated),
    pc: sheet ? { characterId: sheet.id, hp: { ...sheet.hp } } : null,
  }
}
