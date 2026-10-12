// SRD 5.2.1 features with limited uses (2024 rules): how many uses, when they come back, what using one costs,
// and the dice it rolls. The English rules text lives in src/data/srd-features.json (same ids); this table
// holds only the numbers the sheet needs. Counts per level come from the class tables (checked against the
// SRD 5.2.1 PDF); "min 1" means "equal to your modifier (minimum of once)".
import { abilityModifier } from '../abilities'
import type { FeatureRecharge } from '../play'
import { proficiencyBonus } from '../proficiency'
import type { Ability, ClassName } from '../types'

/**
 * What using the feature takes. 'Magic action' counts as the Action; 'Free' = no action (or part of another one);
 * 'Special' = it depends (the spell's casting time, the option chosen). Free spell casts use the spell's casting time.
 */
export type Activation = 'Action' | 'Magic action' | 'Bonus Action' | 'Reaction' | 'Free' | 'Special'

export type UsesFormula =
  | { fixed: number }
  /** [from level, uses] rows, lowest level first */
  | { table: [number, number][] }
  /** the ability modifier, minimum 1 */
  | { ability: Ability }
  | { pb: true }
  /** a pool of class level × n points */
  | { perLevel: number }

export interface FeatureSource {
  className?: ClassName
  subclass?: string
  species?: string
  feat?: string
}

export interface LimitedFeature {
  /** Same id as the text in srd-features.json, unless `textId` says where the text is. */
  id: string
  /** Text shared with another entry (e.g. both Elven Lineage spells use the "elven-lineage" text). */
  textId?: string
  name: string
  source: FeatureSource
  /** Class level (or character level for species) the feature starts at. */
  level: number
  activation: Activation
  uses: UsesFormula
  recharge: FeatureRecharge
  /** From this class level the recharge changes (Bardic Inspiration: Short Rest from Bard 5, Font of Inspiration). */
  rechargeFrom?: { level: number; recharge: FeatureRecharge }
  pool?: boolean
  /** Using it gives the Action back for another action this turn (Action Surge). */
  extraAction?: boolean
  /** One line in English: what it does (the full text is in the data file). */
  summary: (ctx: FeatureContext) => string
  /** Dice to roll when used, e.g. Second Wind "1d10+5". */
  /** The dice it rolls. `applies`: the total goes on the user's own sheet (healing or Temp HP). */
  roll?: (ctx: FeatureContext) => { label: string; expression: string; applies?: 'heal' | 'tempHp' }
}

export interface FeatureContext {
  level: number
  scores: Record<Ability, number>
}

const mod = (ctx: FeatureContext, a: Ability) => abilityModifier(ctx.scores[a])
const plus = (n: number) => (n === 0 ? '' : n > 0 ? `+${n}` : `${n}`)
/** The value for this level from [from level, value] rows. */
export function byLevel<T>(rows: [number, T][], level: number): T {
  let out = rows[0][1]
  for (const [from, v] of rows) if (level >= from) out = v
  return out
}
const martialArtsDie = (level: number) => byLevel([[1, 6], [5, 8], [11, 10], [17, 12]], level)
const bardicDie = (level: number) => byLevel([[1, 6], [5, 8], [10, 10], [15, 12]], level)
const rageDamage = (level: number) => byLevel([[1, 2], [9, 3], [16, 4]], level)

export const LIMITED_FEATURES: LimitedFeature[] = [
  // Barbarian
  {
    id: 'barbarian-rage', name: 'Rage', source: { className: 'Barbarian' }, level: 1, activation: 'Bonus Action',
    uses: { table: [[1, 2], [3, 3], [6, 4], [12, 5], [17, 6]] }, recharge: 'shortOne',
    summary: (c) => `Not in Heavy armor. Resistance to Bludgeoning/Piercing/Slashing, +${rageDamage(c.level)} damage on Strength attacks, Advantage on STR checks and saves; lasts until the end of your next turn, extendable up to 10 minutes.`,
  },
  {
    id: 'barbarian-persistent-rage', name: 'Persistent Rage', source: { className: 'Barbarian' }, level: 15, activation: 'Free',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'When you roll Initiative, regain all expended uses of Rage.',
  },
  {
    id: 'berserker-intimidating-presence', name: 'Intimidating Presence', source: { className: 'Barbarian', subclass: 'Path of the Berserker' }, level: 14,
    activation: 'Bonus Action', uses: { fixed: 1 }, recharge: 'long',
    summary: () => 'Creatures of your choice in a 30-ft Emanation make a WIS save (DC 8 + STR + PB) or are Frightened for 1 minute. Spend a Rage use to restore it.',
  },
  // Bard
  {
    id: 'bard-bardic-inspiration', name: 'Bardic Inspiration', source: { className: 'Bard' }, level: 1, activation: 'Bonus Action',
    uses: { ability: 'cha' }, recharge: 'long', rechargeFrom: { level: 5, recharge: 'short' },
    summary: (c) => `Give a creature within 60 ft a d${bardicDie(c.level)} to add to a failed D20 Test within the next hour.`,
    roll: (c) => ({ label: 'Bardic Inspiration die', expression: `1d${bardicDie(c.level)}` }),
  },
  // Cleric
  {
    id: 'cleric-channel-divinity', name: 'Channel Divinity (Cleric)', source: { className: 'Cleric' }, level: 2, activation: 'Magic action',
    uses: { table: [[2, 2], [6, 3], [18, 4]] }, recharge: 'shortOne',
    summary: () => 'Divine Spark (heal, or CON save vs. Necrotic/Radiant damage) or Turn Undead (WIS save). Save DC = your spell save DC.',
    roll: (c) => ({ label: 'Divine Spark', expression: `${byLevel([[1, 1], [7, 2], [13, 3], [18, 4]], c.level)}d8${plus(mod(c, 'wis'))}` }),
  },
  {
    id: 'cleric-divine-intervention', name: 'Divine Intervention', source: { className: 'Cleric' }, level: 10, activation: 'Magic action',
    uses: { fixed: 1 }, recharge: 'long', summary: () => "Cast any Cleric spell of level 5 or lower that doesn't need a Reaction, without a spell slot or Material components.",
  },
  // Druid
  {
    id: 'druid-wild-shape', name: 'Wild Shape', source: { className: 'Druid' }, level: 2, activation: 'Bonus Action',
    uses: { table: [[2, 2], [6, 3], [17, 4]] }, recharge: 'shortOne',
    summary: () => 'Shape-shift into a Beast form you know for hours equal to half your Druid level.',
  },
  {
    id: 'druid-wild-resurgence', name: 'Wild Resurgence (slot)', source: { className: 'Druid' }, level: 5, activation: 'Free',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'Spend a Wild Shape use to gain a level 1 spell slot. (The other way, a slot for a Wild Shape use: once per turn, only when you have none left.)',
  },
  {
    id: 'land-natural-recovery', name: 'Natural Recovery', source: { className: 'Druid', subclass: 'Circle of the Land' }, level: 6, activation: 'Free',
    uses: { fixed: 1 }, recharge: 'long', summary: (c) => `On a Short Rest, recover spell slots with a total level of up to ${Math.ceil(c.level / 2)} (none of level 6+). Also: one prepared level 1+ Circle spell without a slot per Long Rest.`,
  },
  // Fighter
  {
    id: 'fighter-second-wind', name: 'Second Wind', source: { className: 'Fighter' }, level: 1, activation: 'Bonus Action',
    uses: { table: [[1, 2], [4, 3], [10, 4]] }, recharge: 'shortOne',
    summary: (c) => `Regain 1d10 + ${c.level} Hit Points.`,
    roll: (c) => ({ label: 'Second Wind (HP)', expression: `1d10+${c.level}`, applies: 'heal' }),
  },
  {
    id: 'fighter-action-surge', name: 'Action Surge', source: { className: 'Fighter' }, level: 2, activation: 'Free',
    uses: { table: [[2, 1], [17, 2]] }, recharge: 'short', extraAction: true,
    summary: () => 'On your turn, take one additional action (not the Magic action). Only once per turn.',
  },
  {
    id: 'fighter-indomitable', name: 'Indomitable', source: { className: 'Fighter' }, level: 9, activation: 'Free',
    uses: { table: [[9, 1], [13, 2], [17, 3]] }, recharge: 'long',
    summary: (c) => `Reroll a failed saving throw with a bonus of +${c.level}; you must use the new roll.`,
  },
  // Monk
  {
    id: 'monk-monks-focus', name: 'Focus Points', source: { className: 'Monk' }, level: 2, activation: 'Free',
    uses: { perLevel: 1 }, recharge: 'short', pool: true,
    summary: () => 'Flurry of Blows (2 Unarmed Strikes), Patient Defense (Disengage + Dodge) or Step of the Wind (Disengage + Dash): 1 point each, as a Bonus Action. Save DC 8 + WIS + PB.',
  },
  {
    id: 'monk-uncanny-metabolism', name: 'Uncanny Metabolism', source: { className: 'Monk' }, level: 2, activation: 'Free',
    uses: { fixed: 1 }, recharge: 'long',
    summary: (c) => `When you roll Initiative: regain all Focus Points and heal 1d${martialArtsDie(c.level)} + ${c.level} HP.`,
    roll: (c) => ({ label: 'Uncanny Metabolism (HP)', expression: `1d${martialArtsDie(c.level)}+${c.level}`, applies: 'heal' }),
  },
  {
    id: 'open-hand-wholeness-of-body', name: 'Wholeness of Body', source: { className: 'Monk', subclass: 'Warrior of the Open Hand' }, level: 6,
    activation: 'Bonus Action', uses: { ability: 'wis' }, recharge: 'long',
    summary: (c) => `Heal 1d${martialArtsDie(c.level)} + WIS Hit Points (minimum 1).`,
    roll: (c) => ({ label: 'Wholeness of Body (HP)', expression: `1d${martialArtsDie(c.level)}${plus(mod(c, 'wis'))}`, applies: 'heal' }),
  },
  // Paladin
  {
    id: 'paladin-lay-on-hands', name: 'Lay On Hands', source: { className: 'Paladin' }, level: 1, activation: 'Bonus Action',
    uses: { perLevel: 5 }, recharge: 'long', pool: true,
    summary: () => 'Touch a creature: restore HP from the pool, or spend 5 points to remove the Poisoned condition.',
  },
  {
    id: 'paladin-paladins-smite', name: "Paladin's Smite", source: { className: 'Paladin' }, level: 2, activation: 'Bonus Action',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'Cast Divine Smite once without a spell slot.',
  },
  {
    id: 'paladin-channel-divinity', name: 'Channel Divinity (Paladin)', source: { className: 'Paladin' }, level: 3, activation: 'Special',
    uses: { table: [[3, 2], [11, 3]] }, recharge: 'shortOne',
    summary: () => 'Divine Sense (Bonus Action: sense Celestials, Fiends, Undead for 10 minutes) or your Oath option (e.g. Sacred Weapon).',
  },
  {
    id: 'paladin-faithful-steed', name: 'Faithful Steed', source: { className: 'Paladin' }, level: 5, activation: 'Magic action',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'Cast Find Steed once without a spell slot.',
  },
  {
    id: 'devotion-holy-nimbus', name: 'Holy Nimbus', source: { className: 'Paladin', subclass: 'Oath of Devotion' }, level: 20, activation: 'Bonus Action',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'For 10 minutes: Advantage on saving throws forced by Fiends or Undead; enemies starting their turn in the aura take Radiant damage (CHA + PB); Bright Light. A level 5 slot restores it.',
  },
  // Ranger
  {
    id: 'ranger-favored-enemy', name: 'Favored Enemy', source: { className: 'Ranger' }, level: 1, activation: 'Bonus Action',
    uses: { table: [[1, 2], [5, 3], [9, 4], [13, 5], [17, 6]] }, recharge: 'long',
    summary: () => "Cast Hunter's Mark without a spell slot.",
  },
  {
    id: 'ranger-tireless', name: 'Tireless', source: { className: 'Ranger' }, level: 10, activation: 'Magic action',
    uses: { ability: 'wis' }, recharge: 'long',
    summary: () => 'Gain 1d8 + WIS Temporary Hit Points (minimum 1). (Also: a Short Rest lowers Exhaustion by 1.)',
    roll: (c) => ({ label: 'Tireless (Temp HP)', expression: `1d8${plus(mod(c, 'wis'))}`, applies: 'tempHp' }),
  },
  {
    id: 'ranger-natures-veil', name: "Nature's Veil", source: { className: 'Ranger' }, level: 14, activation: 'Bonus Action',
    uses: { ability: 'wis' }, recharge: 'long', summary: () => 'Become Invisible until the end of your next turn.',
  },
  // Rogue
  {
    id: 'rogue-stroke-of-luck', name: 'Stroke of Luck', source: { className: 'Rogue' }, level: 20, activation: 'Free',
    uses: { fixed: 1 }, recharge: 'short', summary: () => 'Turn a failed D20 Test into a 20.',
  },
  // Sorcerer
  {
    id: 'sorcerer-innate-sorcery', name: 'Innate Sorcery', source: { className: 'Sorcerer' }, level: 1, activation: 'Bonus Action',
    uses: { fixed: 2 }, recharge: 'long', summary: () => 'For 1 minute: Sorcerer spell save DC +1 and Advantage on Sorcerer spell attack rolls.',
  },
  {
    id: 'sorcerer-font-of-magic', name: 'Sorcery Points', source: { className: 'Sorcerer' }, level: 2, activation: 'Free',
    uses: { perLevel: 1 }, recharge: 'long', pool: true,
    summary: () => 'Fuel Metamagic, or convert: spend points to create a spell slot (Bonus Action), or turn a slot into points.',
  },
  {
    id: 'sorcerer-sorcerous-restoration', name: 'Sorcerous Restoration', source: { className: 'Sorcerer' }, level: 5, activation: 'Free',
    uses: { fixed: 1 }, recharge: 'long', summary: (c) => `On a Short Rest, regain up to ${Math.floor(c.level / 2)} expended Sorcery Points.`,
  },
  {
    id: 'draconic-sorcery-dragon-wings', name: 'Dragon Wings', source: { className: 'Sorcerer', subclass: 'Draconic Sorcery' }, level: 14,
    activation: 'Bonus Action', uses: { fixed: 1 }, recharge: 'long', summary: () => 'Fly Speed 60 ft for 1 hour. 3 Sorcery Points restore it.',
  },
  {
    id: 'draconic-sorcery-dragon-companion', name: 'Dragon Companion', source: { className: 'Sorcerer', subclass: 'Draconic Sorcery' }, level: 18,
    activation: 'Magic action', uses: { fixed: 1 }, recharge: 'long', summary: () => 'Cast Summon Dragon without a spell slot.',
  },
  // Warlock
  {
    id: 'warlock-magical-cunning', name: 'Magical Cunning', source: { className: 'Warlock' }, level: 2, activation: 'Special',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'A 1-minute rite: regain expended Pact Magic slots, up to half your maximum (round up).',
  },
  {
    id: 'warlock-contact-patron', name: 'Contact Patron', source: { className: 'Warlock' }, level: 9, activation: 'Special',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'Cast Contact Other Plane without a slot; you automatically succeed on its save.',
  },
  {
    id: 'fiend-patron-dark-ones-own-luck', name: "Dark One's Own Luck", source: { className: 'Warlock', subclass: 'Fiend Patron' }, level: 6,
    activation: 'Free', uses: { ability: 'cha' }, recharge: 'long', summary: () => 'Add 1d10 to an ability check or saving throw (after seeing the roll, once per roll).',
    roll: () => ({ label: "Dark One's Own Luck", expression: '1d10' }),
  },
  {
    id: 'fiend-patron-hurl-through-hell', name: 'Hurl Through Hell', source: { className: 'Warlock', subclass: 'Fiend Patron' }, level: 14,
    activation: 'Free', uses: { fixed: 1 }, recharge: 'long', summary: () => 'On a hit: CHA save or the target is hurled through the Lower Planes (8d10 Psychic). A Pact slot restores it.',
  },
  // Wizard
  {
    id: 'wizard-arcane-recovery', name: 'Arcane Recovery', source: { className: 'Wizard' }, level: 1, activation: 'Free',
    uses: { fixed: 1 }, recharge: 'long', summary: (c) => `On a Short Rest, recover spell slots with a total level of up to ${Math.ceil(c.level / 2)} (none of level 6+).`,
  },
  {
    id: 'wizard-signature-spells', name: 'Signature Spells', source: { className: 'Wizard' }, level: 20, activation: 'Free',
    uses: { fixed: 2 }, recharge: 'short', summary: () => 'Cast each of your two level 3 Signature Spells once at level 3 without a slot.',
  },
  // Species (level = character level)
  {
    id: 'draconic-breath-weapon-fire', name: 'Breath Weapon', source: { species: 'Dragonborn' }, level: 1, activation: 'Special',
    uses: { pb: true }, recharge: 'long',
    summary: () => 'Replace one attack of the Attack action: 15-ft Cone or 30-ft Line; DEX save (DC 8 + CON + PB), half damage on a success. Damage type from your ancestry.',
    roll: (c) => ({ label: 'Breath Weapon', expression: `${byLevel([[1, 1], [5, 2], [11, 3], [17, 4]], c.level)}d10` }),
  },
  {
    id: 'draconic-flight', name: 'Draconic Flight', source: { species: 'Dragonborn' }, level: 5, activation: 'Bonus Action',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'Spectral wings: Fly Speed equal to your Speed for 10 minutes.',
  },
  {
    id: 'stonecunning', name: 'Stonecunning', source: { species: 'Dwarf' }, level: 1, activation: 'Bonus Action',
    uses: { pb: true }, recharge: 'long', summary: () => 'Tremorsense 60 ft for 10 minutes (on or touching stone).',
  },
  {
    id: 'giant-ancestry', name: 'Giant Ancestry', source: { species: 'Goliath' }, level: 1, activation: 'Special',
    uses: { pb: true }, recharge: 'long', summary: () => "Your chosen giant boon (e.g. Stone's Endurance as a Reaction: reduce damage by 1d12 + CON).",
  },
  {
    id: 'large-form', name: 'Large Form', source: { species: 'Goliath' }, level: 5, activation: 'Bonus Action',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'Become Large for 10 minutes: Advantage on STR checks, +10 ft Speed.',
  },
  {
    id: 'adrenaline-rush', name: 'Adrenaline Rush', source: { species: 'Orc' }, level: 1, activation: 'Bonus Action',
    uses: { pb: true }, recharge: 'short', summary: (c) => `Dash as a Bonus Action and gain ${proficiencyBonus(c.level)} Temporary Hit Points.`,
  },
  {
    id: 'relentless-endurance', name: 'Relentless Endurance', source: { species: 'Orc' }, level: 1, activation: 'Free',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'When reduced to 0 HP but not killed outright, drop to 1 HP instead.',
  },
  // Free casts once per Long Rest (spells from lineage, legacy and Mystic Arcanum)
  {
    id: 'elven-lineage-level-3', textId: 'elven-lineage', name: 'Elven Lineage spell (level 3)', source: { species: 'Elf' }, level: 3,
    activation: 'Special', uses: { fixed: 1 }, recharge: 'long',
    summary: () => 'Cast your lineage spell once without a slot: Drow Faerie Fire, High Elf Detect Magic, Wood Elf Longstrider.',
  },
  {
    id: 'elven-lineage-level-5', textId: 'elven-lineage', name: 'Elven Lineage spell (level 5)', source: { species: 'Elf' }, level: 5,
    activation: 'Special', uses: { fixed: 1 }, recharge: 'long',
    summary: () => 'Cast your lineage spell once without a slot: Drow Darkness, High Elf Misty Step, Wood Elf Pass without Trace.',
  },
  {
    id: 'fiendish-legacy-level-3', textId: 'fiendish-legacy', name: 'Fiendish Legacy spell (level 3)', source: { species: 'Tiefling' }, level: 3,
    activation: 'Special', uses: { fixed: 1 }, recharge: 'long',
    summary: () => 'Cast your legacy spell once without a slot: Abyssal Ray of Sickness, Chthonic False Life, Infernal Hellish Rebuke.',
  },
  {
    id: 'fiendish-legacy-level-5', textId: 'fiendish-legacy', name: 'Fiendish Legacy spell (level 5)', source: { species: 'Tiefling' }, level: 5,
    activation: 'Special', uses: { fixed: 1 }, recharge: 'long',
    summary: () => 'Cast your legacy spell once without a slot: Abyssal Hold Person, Chthonic Ray of Enfeeblement, Infernal Darkness.',
  },
  {
    id: 'gnomish-lineage-forest-gnome', name: 'Forest Gnome: Speak with Animals', source: { species: 'Gnome' }, level: 1,
    activation: 'Special', uses: { pb: true }, recharge: 'long',
    summary: () => 'Forest Gnome only: cast Speak with Animals without a spell slot.',
  },
  ...[[6, 11], [7, 13], [8, 15], [9, 17]].map(([spell, level]): LimitedFeature => ({
    id: `warlock-mystic-arcanum-${spell}`, textId: 'warlock-mystic-arcanum', name: `Mystic Arcanum (level ${spell})`,
    source: { className: 'Warlock' }, level, activation: 'Special', uses: { fixed: 1 }, recharge: 'long',
    summary: () => `Cast your level ${spell} arcanum spell once without a spell slot.`,
  })),
  // Feats
  {
    id: 'magic-initiate', name: 'Magic Initiate (free cast)', source: { feat: 'Magic Initiate' }, level: 1, activation: 'Special',
    uses: { fixed: 1 }, recharge: 'long', summary: () => 'Cast your Magic Initiate level 1 spell once without a spell slot.',
  },
]

export function findLimitedFeature(id: string): LimitedFeature | undefined {
  return LIMITED_FEATURES.find((f) => f.id === id)
}

/** Number of uses (or pool points) for a character at a class level, at least 1. */
export function featureUses(f: LimitedFeature, ctx: FeatureContext): number {
  const u = f.uses
  if ('fixed' in u) return u.fixed
  if ('table' in u) return byLevel(u.table, ctx.level)
  if ('ability' in u) return Math.max(1, mod(ctx, u.ability))
  if ('pb' in u) return proficiencyBonus(ctx.level)
  return Math.max(1, u.perLevel * ctx.level)
}

export function featureRecharge(f: LimitedFeature, level: number): FeatureRecharge {
  return f.rechargeFrom && level >= f.rechargeFrom.level ? f.rechargeFrom.recharge : f.recharge
}

export interface CharacterForFeatures {
  className: ClassName
  subclass: string
  level: number
  species: string
  feats: string[]
}

/** Features this character qualifies for (class, subclass, level, species, feats). */
export function availableFeatures(c: CharacterForFeatures): LimitedFeature[] {
  return LIMITED_FEATURES.filter((f) => {
    const s = f.source
    if (f.level > c.level) return false
    if (s.className && s.className !== c.className) return false
    if (s.subclass && s.subclass.toLowerCase() !== c.subclass.trim().toLowerCase()) return false
    if (s.species && !c.species.toLowerCase().startsWith(s.species.toLowerCase())) return false
    if (s.feat && !c.feats.includes(s.feat)) return false
    return true
  })
}
