// What players may see of a fight (sent to their phones in a live lobby as a 'fight' message).
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

/**
 * The fight players see in a live lobby: the most recently changed running fight,
 * preferring the room's campaign. Fights still being set up stay secret.
 */
export function liveFight(encounters: Encounter[], campaignId: string | null): Encounter | null {
  const running = encounters.filter((e) => e.status === 'active').sort((a, b) => b.updatedAt - a.updatedAt)
  return running.find((e) => campaignId && e.campaignId === campaignId) ?? running[0] ?? null
}

const HEALTH = ['healthy', 'hurt', 'bloodied', 'down'] as const
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)
const whole = (v: unknown, min: number, max: number) => (Number.isInteger(v) && (v as number) >= min && (v as number) <= max ? (v as number) : null)

/** Check a fight view received from the DM's device (still network data: never trust its shape). */
export function parsePlayerView(v: unknown): PlayerEncounterView | null {
  if (!isObj(v) || !Array.isArray(v.combatants) || v.combatants.length > 200) return null
  const id = text(v.id, 64)
  const round = whole(v.round, 0, 100_000)
  if (!id || round === null || !['setup', 'active', 'ended'].includes(v.status as string)) return null
  const combatants: PlayerCombatant[] = []
  for (const c of v.combatants) {
    if (!isObj(c)) return null
    const cid = text(c.id, 64)
    const name = text(c.name, 100)
    if (!cid || name === null || (c.kind !== 'pc' && c.kind !== 'monster') || !HEALTH.includes(c.health as HealthStatus)) return null
    const effects = Array.isArray(c.effects)
      ? c.effects.slice(0, 30).flatMap((ef) => (isObj(ef) && text(ef.name, 100) ? [{ name: text(ef.name, 100)!, rounds: whole(ef.rounds, 0, 10_000) }] : []))
      : []
    const pcHp = isObj(c.pc) && isObj(c.pc.hp) ? c.pc.hp : null
    const pc = isObj(c.pc) && text(c.pc.characterId, 64) && pcHp && whole(pcHp.max, 0, 9999) !== null && whole(pcHp.current, 0, 9999) !== null
      ? { characterId: text(c.pc.characterId, 64)!, hp: { max: pcHp.max as number, current: pcHp.current as number, temp: whole(pcHp.temp, 0, 9999) ?? 0 } }
      : null
    combatants.push({
      id: cid, name, kind: c.kind, initiative: whole(c.initiative, -100, 100), active: c.active === true,
      effects, health: c.health as HealthStatus, pc,
    })
  }
  return { id, name: text(v.name, 100) ?? '', status: v.status as Encounter['status'], round, hiddenTurn: v.hiddenTurn === true, combatants }
}

/** Whose turn it is, as players see it: a visible combatant, 'hidden' (someone unseen), or null. */
export function activeTurn(view: PlayerEncounterView): PlayerCombatant | 'hidden' | null {
  if (view.hiddenTurn) return 'hidden'
  return view.combatants.find((c) => c.active) ?? null
}
