// The DM's offline generators (Phase 3.5): NPC, tavern/shop, plot hook, weather & event, loot and
// quick encounters. Pure: every random choice comes from `rng`, so results can be tested and any one
// part can be rerolled. Content is homebrew (tables.ts); loot items and monsters are SRD 5.2.1 data.
// Results turn into notebook pages (toPage) the DM can save with one tap.
import { rollDie, xpForCR, type Rng } from '../../rules'
import type { SrdMonster } from '../monsters'
import type { Note, NoteKind } from '../note'
import * as T from './tables'

export const pick = <T,>(list: readonly T[], rng: Rng): T => list[Math.floor(rng() * list.length)]

/** A generator: how to roll each part (so one part can be rolled again). */
type Parts<R> = { [K in keyof R]: (rng: Rng) => R[K] }
const rollAll = <R,>(parts: Parts<R>, rng: Rng): R =>
  Object.fromEntries(Object.entries(parts).map(([k, f]) => [k, (f as (r: Rng) => unknown)(rng)])) as R

/** Roll one part again, keeping the rest. */
export const reroll = <R,>(parts: Parts<R>, current: R, key: keyof R, rng: Rng): R => ({ ...current, [key]: parts[key](rng) })

const fullName = (rng: Rng) => `${pick(T.FIRST_NAMES, rng)} ${pick(T.LAST_NAMES, rng)}`

// --- NPC ---

export interface GenNpc { name: string; species: string; role: string; look: string; voice: string; personality: string; wants: string; secret: string; attitude: string }
export const NPC_PARTS: Parts<GenNpc> = {
  name: fullName, species: (r) => pick(T.SPECIES, r), role: (r) => pick(T.ROLES, r), look: (r) => pick(T.LOOKS, r), voice: (r) => pick(T.VOICES, r),
  personality: (r) => pick(T.PERSONALITIES, r), wants: (r) => pick(T.WANTS, r), secret: (r) => pick(T.SECRETS, r), attitude: (r) => pick(T.ATTITUDES, r),
}
export const genNpc = (rng: Rng) => rollAll(NPC_PARTS, rng)

// --- Tavern / shop ---

export interface GenTavern { name: string; type: string; owner: string; atmosphere: string; specialty: string; rumour: string }
export const TAVERN_PARTS: Parts<GenTavern> = {
  name: (r) => `The ${pick(T.TAVERN_ADJECTIVES, r)} ${pick(T.TAVERN_NOUNS, r)}`, type: (r) => pick(T.PLACE_TYPES, r), owner: fullName,
  atmosphere: (r) => pick(T.ATMOSPHERES, r), specialty: (r) => pick(T.SPECIALTIES, r), rumour: (r) => pick(T.RUMOURS, r),
}
export const genTavern = (rng: Rng) => rollAll(TAVERN_PARTS, rng)

// --- Plot hook ---

export interface GenHook { patron: string; patronRole: string; problem: string; place: string; twist: string; reward: string }
export const HOOK_PARTS: Parts<GenHook> = {
  patron: fullName, patronRole: (r) => pick(T.ROLES, r), problem: (r) => pick(T.HOOK_PROBLEMS, r), place: (r) => pick(T.HOOK_PLACES, r),
  twist: (r) => pick(T.HOOK_TWISTS, r), reward: (r) => pick(T.HOOK_REWARDS, r),
}
export const genHook = (rng: Rng) => rollAll(HOOK_PARTS, rng)

// --- Weather & event ---

export type EventSetting = keyof typeof T.EVENTS
export const genWeather = (rng: Rng) => pick(T.WEATHER, rng)
export const genEvent = (setting: EventSetting, rng: Rng) => pick(T.EVENTS[setting], rng)

// --- Results as notebook pages ---

/** A generated NPC, tavern or hook as a notebook page (the DM can edit it after saving). */
export function toPage(
  g: { kind: 'npc'; npc: GenNpc } | { kind: 'tavern'; tavern: GenTavern } | { kind: 'hook'; hook: GenHook },
): { kind: NoteKind; title: string; fields: Note['fields']; body: string } {
  if (g.kind === 'npc') {
    const n = g.npc
    return {
      kind: 'npc', title: n.name,
      fields: { role: n.role, attitude: n.attitude, look: `${n.look} · ${n.voice}`, wants: n.wants },
      body: `${n.species} · นิสัย: ${n.personality}\nความลับ (DM): ${n.secret}`,
    }
  }
  if (g.kind === 'tavern') {
    const t = g.tavern
    return {
      kind: 'place', title: t.name,
      fields: { type: t.type, who: `[[${t.owner}]] (เจ้าของ)` },
      body: `บรรยากาศ: ${t.atmosphere}\nของเด่น: ${t.specialty}\nข่าวลือ: ${t.rumour}`,
    }
  }
  const h = g.hook
  return {
    kind: 'quest', title: h.problem,
    fields: { status: 'open', giver: `[[${h.patron}]] (${h.patronRole})`, goal: `${h.problem} ที่${h.place}`, reward: h.reward },
    body: `สถานที่: ${h.place}\nจุดหักมุม (DM): ${h.twist}`,
  }
}

// --- Loot (homebrew amounts; the magic items are SRD 5.2.1) ---

export interface LootItem { id: string; name: string; rarity: string; category: string; attunement: boolean; desc: string }
export const LOOT_BANDS = [
  { label: 'CR 0–4', min: 0 }, { label: 'CR 5–10', min: 5 }, { label: 'CR 11–16', min: 11 }, { label: 'CR 17+', min: 17 },
] as const

export interface GenLoot { coins: { pp: number; gp: number; sp: number }; valuables: { value: number; text: string }[]; items: LootItem[] }

const dice = (n: number, sides: number, rng: Rng) => Array.from({ length: n }, () => rollDie(sides, rng)).reduce((a, b) => a + b, 0)

/** Weighted rarity tables for magic items, per band. */
const RARITY_WEIGHTS: [string, number][][] = [
  [['Common', 5], ['Uncommon', 5]],
  [['Common', 1], ['Uncommon', 5], ['Rare', 4]],
  [['Uncommon', 2], ['Rare', 5], ['Very Rare', 3]],
  [['Rare', 2], ['Very Rare', 5], ['Legendary', 3]],
]

function weighted(table: [string, number][], rng: Rng): string {
  let roll = rng() * table.reduce((sum, [, w]) => sum + w, 0)
  for (const [value, w] of table) {
    roll -= w
    if (roll < 0) return value
  }
  return table[table.length - 1][0]
}

/**
 * Treasure for a fight: an individual monster's pocket (coins only) or a hoard (coins, gems and art,
 * magic items). `band` is the LOOT_BANDS index. Amounts are a simple homebrew guide, not a rules table.
 */
export function genLoot(items: LootItem[], band: number, hoard: boolean, rng: Rng): GenLoot {
  const b = Math.max(0, Math.min(3, band))
  const coins = { pp: 0, gp: 0, sp: 0 }
  if (!hoard) {
    if (b === 0) { coins.gp = dice(3, 6, rng); coins.sp = dice(4, 6, rng) }
    if (b === 1) coins.gp = dice(2, 8, rng) * 10
    if (b === 2) { coins.gp = dice(2, 10, rng) * 10; coins.pp = dice(1, 6, rng) * 10 }
    if (b === 3) { coins.gp = dice(2, 10, rng) * 100; coins.pp = dice(2, 8, rng) * 10 }
    return { coins, valuables: [], items: [] }
  }
  coins.gp = [dice(3, 4, rng) * 50, dice(5, 6, rng) * 100, dice(3, 8, rng) * 500, dice(6, 10, rng) * 1000][b]
  if (b === 3) coins.pp = dice(5, 8, rng) * 100
  const [low, high] = [[10, 50], [25, 250], [250, 1000], [750, 5000]][b]
  const pool = T.VALUABLES.filter((v) => v.value >= low && v.value <= high)
  const valuables = Array.from({ length: rollDie([4, 6, 6, 8][b], rng) }, () => pick(pool, rng))
  const count = [rollDie(2, rng), rollDie(3, rng), rollDie(4, rng), rollDie(4, rng) + 1][b]
  const lootable = items.filter((i) => i.rarity !== 'Varies' && i.rarity !== 'Artifact')
  const chosen: LootItem[] = []
  for (let i = 0; i < count; i++) {
    const rarity = weighted(RARITY_WEIGHTS[b], rng)
    const options = lootable.filter((x) => x.rarity === rarity)
    if (options.length) chosen.push(pick(options, rng))
  }
  return { coins, valuables, items: chosen }
}

// --- Quick encounter (homebrew XP guide; monsters are SRD 5.2.1) ---

export type Difficulty = 'easy' | 'medium' | 'hard'
export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: 'ง่าย', medium: 'ปานกลาง', hard: 'ยาก' }
// Chosen so the budget lands near the 2024 guidance at levels 1, 5 and 10 (still a homebrew guide).
const DIFFICULTY_SHARE: Record<Difficulty, number> = { easy: 0.25, medium: 0.4, hard: 0.6 }

/** The XP an encounter aims for: per character, a share of the XP of a monster with CR = their level. */
export function encounterBudget(level: number, partySize: number, difficulty: Difficulty): number {
  return Math.round(xpForCR(Math.max(1, Math.min(20, level))) * DIFFICULTY_SHARE[difficulty] * partySize)
}

export interface GenEncounter { budget: number; totalXp: number; groups: { monster: SrdMonster; count: number }[] }

/**
 * Pick one or two kinds of monster that fill the XP budget: a main group, then (if much is left) a
 * second, cheaper group. `type` limits the creature type (e.g. "undead"); null = any.
 */
export function genEncounter(
  monsters: SrdMonster[], opts: { level: number; partySize: number; difficulty: Difficulty; type: string | null }, rng: Rng,
): GenEncounter {
  const budget = encounterBudget(opts.level, opts.partySize, opts.difficulty)
  const fits = monsters.filter((m) => m.xp > 0 && m.cr <= opts.level + 2 && (!opts.type || m.type === opts.type))
  const groups: GenEncounter['groups'] = []
  const choose = (max: number, minShare: number, maxCount: number) => {
    const affordable = fits.filter((m) => m.xp <= max && !groups.some((g) => g.monster.id === m.id))
    if (!affordable.length) return
    const big = affordable.filter((m) => m.xp >= max * minShare)
    const monster = pick(big.length ? big : affordable, rng)
    groups.push({ monster, count: Math.max(1, Math.min(maxCount, Math.floor(max / monster.xp))) })
  }
  choose(budget, 1 / 6, 6)
  const left = budget - groups.reduce((s, g) => s + g.monster.xp * g.count, 0)
  if (left >= budget * 0.25) choose(left, 1 / 4, 4)
  return { budget, totalXp: groups.reduce((s, g) => s + g.monster.xp * g.count, 0), groups }
}
