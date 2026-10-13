import { describe, expect, it } from 'vitest'
import items from '../../data/srd-magic-items.json'
import { loadSrdMonsters } from '../monsters'
import {
  encounterBudget, genEncounter, genHook, genLoot, genNpc, genTavern, NPC_PARTS, reroll, toPage, type LootItem,
} from './index'

/** A repeatable random source (mulberry32). */
function seeded(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('NPC, tavern and hook generators', () => {
  it('fill every part, and a reroll changes only that part', () => {
    const rng = seeded(1)
    const npc = genNpc(rng)
    expect(Object.values(npc).every((v) => typeof v === 'string' && v.length > 0)).toBe(true)
    expect(npc.name).toMatch(/^[A-Z][a-z]+ [A-Z][a-z']+$/)
    let other = npc
    for (let i = 0; i < 20 && other.role === npc.role; i++) other = reroll(NPC_PARTS, npc, 'role', rng)
    expect(other.role).not.toBe(npc.role)
    expect({ ...other, role: npc.role }).toEqual(npc)
  })

  it('become notebook pages', () => {
    const rng = seeded(2)
    const npc = toPage({ kind: 'npc', npc: genNpc(rng) })
    expect(npc.kind).toBe('npc')
    expect(Object.keys(npc.fields)).toEqual(['role', 'attitude', 'look', 'wants'])
    const place = toPage({ kind: 'tavern', tavern: genTavern(rng) })
    expect(place.kind).toBe('place')
    expect(place.title).toMatch(/^The /)
    expect(place.fields.who).toMatch(/^\[\[.+\]\] \(เจ้าของ\)$/) // the owner is a link to a new NPC page
    const quest = toPage({ kind: 'hook', hook: genHook(rng) })
    expect(quest).toMatchObject({ kind: 'quest', fields: { status: 'open' } })
  })
})

describe('SRD magic item data', () => {
  it('splits healing potions and spell scrolls into their 2024 rarity tiers', () => {
    const rarity = (name: string) => (items as LootItem[]).find((i) => i.name === name)?.rarity
    expect(['Potion of Healing', 'Potion of Greater Healing', 'Potion of Superior Healing', 'Potion of Supreme Healing'].map(rarity))
      .toEqual(['Common', 'Uncommon', 'Rare', 'Very Rare'])
    expect(['Spell Scroll (Cantrip or Level 1)', 'Spell Scroll (Level 2 or 3)', 'Spell Scroll (Level 4 or 5)', 'Spell Scroll (Level 6 to 8)', 'Spell Scroll (Level 9)'].map(rarity))
      .toEqual(['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'])
    expect(['Weapon +1', 'Armor +1', 'Shield +3'].map(rarity)).toEqual(['Uncommon', 'Rare', 'Very Rare'])
    expect(rarity('Weapon')).toBeUndefined() // "+1/+2/+3" parents are left out
  })

  it('has the SRD 5.2.1 PDF texts, with tables one row per line', () => {
    const desc = (id: string) => (items as LootItem[]).find((i) => i.id === id)?.desc ?? ''
    // 5e-bits had a Potion of Healing fragment here, and the Gaseous Form text under Potion of Heroism.
    expect(desc('potion-of-gaseous-form')).toContain('the Gaseous Form spell for 1 hour (no Concentration required)')
    expect(desc('potion-of-heroism')).toContain('10 Temporary Hit Points')
    expect(desc('potions-of-healing-common')).toContain('\nPotion of Healing (supreme) | 10d4 + 20 | Very Rare')
    expect(desc('amulet-of-the-planes')).toContain('\n71–80 | Random location on an Outer Plane')
    expect(desc('ammunition-of-slaying').split('\n').filter((row) => /^\d\d–\d\d \| /.test(row))).toHaveLength(14)
    // Every item starts with its type line, and no words are run together ("whereyou").
    for (const item of items as LootItem[]) {
      expect(item.desc).toMatch(/^(Armor|Weapon|Wondrous Item|Potion|Ring|Rod|Scroll|Staff|Wand)\b[^\n]* {2}\n /)
      expect(item.desc).not.toMatch(/\b(whereyou|yourlast|toa|insideit)\b/)
      expect(item.desc).not.toMatch(/\b(tak-ing|dis-appears|cancel-ing|suc-cessful|non-magical)\b/) // line-break hyphens
    }
  })
})

describe('loot', () => {
  const all = items as LootItem[]
  it('a monster pocket has only coins; a hoard has valuables and SRD magic items of the band', () => {
    const rng = seeded(3)
    const pocket = genLoot(all, 0, false, rng)
    expect(pocket.items).toEqual([])
    expect(pocket.coins.gp).toBeGreaterThanOrEqual(3)
    for (let i = 0; i < 30; i++) {
      const hoard = genLoot(all, 0, true, rng)
      expect(hoard.items.length).toBeGreaterThanOrEqual(1)
      expect(hoard.items.every((x) => x.rarity === 'Common' || x.rarity === 'Uncommon')).toBe(true)
      expect(hoard.valuables.every((v) => v.value <= 50)).toBe(true)
    }
    const high = genLoot(all, 3, true, rng)
    expect(high.items.every((x) => ['Rare', 'Very Rare', 'Legendary'].includes(x.rarity))).toBe(true)
  })
})

describe('quick encounter', () => {
  it('stays within the XP budget, the CR range and the creature type', async () => {
    const monsters = await loadSrdMonsters()
    const rng = seeded(4)
    expect(encounterBudget(1, 4, 'medium')).toBe(320) // CR 1 = 200 XP × 0.4 × 4 players
    for (const level of [1, 3, 5, 10, 15]) {
      for (const difficulty of ['easy', 'medium', 'hard'] as const) {
        const e = genEncounter(monsters, { level, partySize: 4, difficulty, type: null }, rng)
        expect(e.groups.length).toBeGreaterThanOrEqual(1)
        expect(e.totalXp).toBeLessThanOrEqual(e.budget)
        expect(e.groups.every((g) => g.monster.cr <= level + 2 && g.count >= 1)).toBe(true)
      }
    }
    const undead = genEncounter(monsters, { level: 5, partySize: 4, difficulty: 'medium', type: 'undead' }, rng)
    expect(undead.groups.every((g) => g.monster.type === 'undead')).toBe(true)
  })
})
