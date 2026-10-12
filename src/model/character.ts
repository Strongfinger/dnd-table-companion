// The Character record saved on the device (IndexedDB) and used for JSON export/import.
// Only things the player enters are stored; calculated numbers come from deriveSheet().

import { FRESH_TURN, type Ability, type ActionEconomy, type AttackInput, type Condition, type SheetInput } from '../rules'

export interface Character extends SheetInput {
  id: string
  /** Bump this when the shape changes, so old exported files can be upgraded on import. */
  schemaVersion: 1
  name: string
  player: string
  subclass: string
  species: string
  background: string
  alignment: string
  /** The campaign this character plays in, or null if none yet. */
  campaignId: string | null
  /** The device that owns this character (the player's phone). Set on first save. */
  ownerDeviceId: string
  /** Sync bookkeeping (see model/sync.ts): bumps on every save, last device to change it. */
  rev: number
  updatedBy: string
  /** Feat names, e.g. the background's Origin feat and Human Versatile's extra feat. */
  feats: string[]

  /** current is kept between 0 and max; temp HP is separate and lost first. */
  hp: { max: number; current: number; temp: number }
  /** Single class: total Hit Dice = level, die size comes from the class. */
  hitDiceSpent: number
  deathSaves: { successes: number; failures: number }
  heroicInspiration: boolean
  /** 0–6 (2024: −2 per level to D20 Tests, −5 ft. Speed; level 6 = death). */
  exhaustion: number
  conditions: Condition[]
  /** Action / Bonus Action / Reaction used this turn. */
  turn: ActionEconomy
  /** Name of the spell being concentrated on, or '' if none. */
  concentration: string
  /** Limited-use features like Second Wind or Channel Divinity. */
  features: { id: string; name: string; max: number; used: number; recharge: 'short' | 'long' }[]
  /** Entered by hand for now (armor rules come later). */
  ac: number
  speed: number

  /** Spell slots per spell level 1–9: index 0 = 1st level. */
  spellSlots: { max: number; used: number }[]
  spells: { id: string; name: string; level: number; prepared: boolean }[]

  inventory: { id: string; name: string; qty: number }[]
  coins: { cp: number; sp: number; ep: number; gp: number; pp: number }

  /** Free text: languages, tools, armor/weapon training. */
  proficienciesText: string
  /** Free text: class features, species traits, feats. */
  featuresText: string
  notes: string
  /**
   * Set when this character is a creature from a stat block (a monster or NPC the DM handed to a
   * player): shown as "Monster · CR x" instead of a class; PB and Hit Dice come from here.
   */
  monster?: { cr: number; pb: number; hitDie: number; source: string }

  createdAt: number
  updatedAt: number
}

export type Attack = AttackInput

export function newId(): string {
  return crypto.randomUUID()
}

const DEFAULT_SCORES: Record<Ability, number> = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }

/** A blank level 1 character, with any fields overridden. */
export function createCharacter(overrides: Partial<Character> = {}): Character {
  const now = Date.now()
  return {
    id: newId(),
    schemaVersion: 1,
    name: '',
    player: '',
    className: 'Fighter',
    subclass: '',
    level: 1,
    species: '',
    background: '',
    alignment: '',
    campaignId: null,
    ownerDeviceId: '',
    rev: 0,
    updatedBy: '',
    feats: [],
    scores: { ...DEFAULT_SCORES },
    saveProficiencies: [],
    skills: {},
    initiativeProficient: false,
    initiativeMisc: 0,
    spellcastingAbility: null,
    attacks: [],
    hp: { max: 10, current: 10, temp: 0 },
    hitDiceSpent: 0,
    deathSaves: { successes: 0, failures: 0 },
    heroicInspiration: false,
    exhaustion: 0,
    conditions: [],
    concentration: '',
    turn: { ...FRESH_TURN },
    features: [],
    ac: 10,
    speed: 30,
    spellSlots: Array.from({ length: 9 }, () => ({ max: 0, used: 0 })),
    spells: [],
    inventory: [],
    coins: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    proficienciesText: '',
    featuresText: '',
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/**
 * Fill in fields that didn't exist when an older character was saved,
 * so screens never see `undefined`. Stored values always win.
 */
export function withDefaults(stored: Partial<Character> & { id: string }): Character {
  return { ...createCharacter(), ...stored }
}
