// Real characters from the DM's previous campaign (D&D Beyond PDFs, kept out of Git).
// Test data only: never import this from app/UI code (it must not ship in the app).
// Non-SRD options (species, backgrounds, feats) are stored as plain text labels only.
// `expected` holds the numbers printed on each paper sheet; corrections are commented.

import type { Skill } from '../skills'
import type { Ability, ClassName, ProficiencyLevel } from '../types'

export interface SheetFixture {
  name: string
  className: ClassName
  level: number
  species: string
  background: string
  scores: Record<Ability, number>
  saveProficiencies: Ability[]
  skills: Partial<Record<Skill, ProficiencyLevel>>
  /** Rolled hit die results for levels 2+; omit when HP used fixed values. */
  hpRolls?: number[]
  /** Extra max HP per level, e.g. Dwarven Toughness (+1). */
  hpBonusPerLevel?: number
  /** Extra initiative bonus, e.g. from the Alert feat. */
  initiativeExtra?: number
  spellcastingAbility?: Ability
  attacks: { name: string; ability: Ability }[]
  expected: {
    saves: Record<Ability, number>
    skills: Partial<Record<Skill, number>>
    passivePerception: number
    passiveInsight: number
    passiveInvestigation: number
    initiative: number
    maxHp: number
    ac: number // not checked yet: the engine has no armor rule
    spellSaveDC?: number
    spellAttack?: number
    attackHit: Record<string, number>
  }
}

export const boom: SheetFixture = {
  name: 'Boom',
  className: 'Fighter',
  level: 2,
  species: 'Human', // 2024 Human (Skillful, Versatile → Alert)
  background: 'Soldier',
  scores: { str: 17, dex: 13, con: 14, int: 8, wis: 10, cha: 13 },
  saveProficiencies: ['str', 'con'],
  skills: { Athletics: 'proficient', Insight: 'proficient', Intimidation: 'proficient', Persuasion: 'proficient', Perception: 'proficient' },
  hpRolls: [5], // level 2: rolled 5 on d10
  initiativeExtra: 2, // Alert (2024): + proficiency bonus (+2 at level 2)
  attacks: [{ name: 'Greatsword', ability: 'str' }, { name: 'Flail', ability: 'str' }, { name: 'Javelin', ability: 'str' }],
  expected: {
    saves: { str: 5, dex: 1, con: 4, int: -1, wis: 0, cha: 1 },
    skills: { Athletics: 5, Insight: 2, Intimidation: 3, Persuasion: 3, Perception: 2 },
    passivePerception: 12,
    passiveInsight: 12,
    passiveInvestigation: 9,
    initiative: 3, // Dex +1 + Alert +2 (the level-1 PDF shows +1: Alert not applied)
    maxHp: 19,
    ac: 16, // Chain Mail
    attackHit: { Greatsword: 5, Flail: 5, Javelin: 5 },
  },
}

export const hypenosz: SheetFixture = {
  // Built with the 2014 Paladin (no spellcasting at level 1); a 2024 Paladin 1 would have Cha spells, DC 12.
  name: 'HypenosZ',
  className: 'Paladin',
  level: 1,
  species: 'Human',
  background: 'Noble', // non-SRD, label only
  scores: { str: 16, dex: 9, con: 15, int: 11, wis: 13, cha: 14 },
  saveProficiencies: ['wis', 'cha'],
  skills: { Athletics: 'proficient', History: 'proficient', Insight: 'proficient', Persuasion: 'proficient' },
  attacks: [{ name: 'Battleaxe', ability: 'str' }, { name: 'Javelin', ability: 'str' }],
  expected: {
    saves: { str: 3, dex: -1, con: 2, int: 0, wis: 3, cha: 4 },
    skills: { Athletics: 5, History: 2, Insight: 3, Persuasion: 4, Perception: 1, Stealth: -1 },
    passivePerception: 11,
    passiveInsight: 13,
    passiveInvestigation: 10,
    initiative: -1,
    maxHp: 12,
    ac: 18, // Chain Mail + Shield
    attackHit: { Battleaxe: 5, Javelin: 5 },
  },
}

export const marksuppp: SheetFixture = {
  name: 'marksuppp',
  className: 'Rogue',
  level: 1,
  species: 'Human',
  background: 'Sage',
  scores: { str: 12, dex: 15, con: 11, int: 9, wis: 15, cha: 13 },
  saveProficiencies: ['dex', 'int'],
  skills: {
    Arcana: 'proficient', History: 'proficient', Insight: 'proficient', Investigation: 'proficient',
    Persuasion: 'proficient', 'Sleight of Hand': 'expertise', Stealth: 'expertise',
  },
  spellcastingAbility: 'wis', // Magic Initiate (Wizard), Wisdom chosen
  attacks: [{ name: 'Dagger', ability: 'dex' }, { name: 'Shortbow', ability: 'dex' }, { name: 'Shortsword', ability: 'dex' }],
  expected: {
    saves: { str: 1, dex: 4, con: 0, int: 1, wis: 2, cha: 1 },
    skills: {
      Arcana: 1, History: 1, Insight: 4, Investigation: 1, Persuasion: 3,
      'Sleight of Hand': 6, Stealth: 6, Acrobatics: 2, Perception: 2,
    },
    passivePerception: 12,
    passiveInsight: 14,
    passiveInvestigation: 11,
    initiative: 2,
    maxHp: 8,
    ac: 13, // Leather 11 + Dex 2 (sheet shows 12: armor not equipped in D&D Beyond)
    // Sheet header says INT / DC 7 / -1, but the feat uses Wisdom (True Strike shows +4):
    // DC = 8 + 2 + 2 = 12, attack = 2 + 2 = +4.
    spellSaveDC: 12,
    spellAttack: 4,
    attackHit: { Dagger: 4, Shortbow: 4, Shortsword: 4 },
  },
}

export const petchyom: SheetFixture = {
  name: 'PetchYom',
  className: 'Cleric',
  level: 1,
  species: 'Dwarf',
  background: 'Acolyte',
  scores: { str: 14, dex: 8, con: 15, int: 12, wis: 16, cha: 10 },
  saveProficiencies: ['wis', 'cha'],
  skills: { Insight: 'proficient', Medicine: 'proficient', Persuasion: 'proficient', Religion: 'proficient' },
  hpBonusPerLevel: 1, // Dwarven Toughness
  spellcastingAbility: 'wis',
  attacks: [],
  expected: {
    saves: { str: 2, dex: -1, con: 2, int: 1, wis: 5, cha: 2 },
    skills: { Insight: 5, Medicine: 5, Persuasion: 2, Religion: 3, 'Animal Handling': 3, Perception: 3 },
    passivePerception: 13,
    passiveInsight: 15,
    passiveInvestigation: 11,
    initiative: -1,
    maxHp: 11,
    ac: 9, // no armor: 10 + Dex (-1)
    spellSaveDC: 13,
    spellAttack: 5,
    attackHit: {},
  },
}

export const ALL_FIXTURES = [boom, hypenosz, marksuppp, petchyom]
