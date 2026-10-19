import { describe, expect, it } from 'vitest'
import { addBuff, buffedArmorClass, buffsAfterRest, buffTotals, type Buff } from './buffs'
import { deriveSheet, type SheetInput } from './sheet'

const buff = (over: Partial<Buff>): Buff => ({ id: over.name ?? 'x', name: 'X', note: '', mods: {}, ends: 'manual', ...over })
const longstrider = buff({ id: 'ls', name: 'Longstrider', mods: { speed: 10 }, ends: 'shortRest' })
const blessing = buff({ id: 'bl', name: 'Blessing', mods: { skills: 1 }, ends: 'longRest' })
const shieldOfFaith = buff({ id: 'sf', name: 'Shield of Faith', mods: { ac: 2 } })

describe('buffTotals', () => {
  it('adds different buffs together', () => {
    expect(buffTotals([longstrider, blessing, shieldOfFaith])).toEqual({ ac: 2, speed: 10, attack: 0, saves: 0, skills: 1, initiative: 0 })
    expect(buffTotals()).toEqual({ ac: 0, speed: 0, attack: 0, saves: 0, skills: 0, initiative: 0 })
  })

  it('the same effect twice does not stack: the higher value counts', () => {
    const weak = buff({ id: 'a', name: 'Blessing', mods: { skills: 1, saves: 1 } })
    const strong = buff({ id: 'b', name: 'blessing ', mods: { skills: 2 } })
    expect(buffTotals([weak, strong])).toMatchObject({ skills: 2, saves: 1 })
  })

  it('penalties count too; the same penalty twice counts its biggest value', () => {
    expect(buffTotals([buff({ name: 'Curse', mods: { attack: -2 } })]).attack).toBe(-2)
    expect(buffTotals([buff({ id: 'a', name: 'Curse', mods: { attack: -1 } }), buff({ id: 'b', name: 'Curse', mods: { attack: -3 } })]).attack).toBe(-3)
  })
})

describe('addBuff', () => {
  it('replaces a buff with the same name (cast again = fresh duration)', () => {
    const again = { ...longstrider, id: 'ls2', ends: 'longRest' as const }
    expect(addBuff([longstrider, blessing], again)).toEqual([blessing, again])
  })
})

describe('buffsAfterRest', () => {
  const all = [longstrider, blessing, shieldOfFaith]
  it('a Short Rest ends only "until short rest" buffs', () => {
    expect(buffsAfterRest(all, 'short')).toEqual([blessing, shieldOfFaith])
  })
  it('a Long Rest ends short- and long-rest buffs; manual ones stay', () => {
    expect(buffsAfterRest(all, 'long')).toEqual([shieldOfFaith])
  })
})

describe('buffedArmorClass', () => {
  it('adds AC buffs, kept within 1–40', () => {
    expect(buffedArmorClass(16, [shieldOfFaith])).toBe(18)
    expect(buffedArmorClass(16)).toBe(16)
    expect(buffedArmorClass(39, [buff({ name: 'Big', mods: { ac: 5 } })])).toBe(40)
    expect(buffedArmorClass(2, [buff({ name: 'Low', mods: { ac: -5 } })])).toBe(1)
  })
})

describe('deriveSheet with buffs', () => {
  const base: SheetInput = {
    className: 'Rogue', level: 1, scores: { str: 10, dex: 16, con: 12, int: 10, wis: 14, cha: 10 },
    saveProficiencies: ['dex', 'int'], skills: { Perception: 'proficient' }, initiativeProficient: false, initiativeMisc: 0,
    spellcastingAbility: 'wis', attacks: [{ id: 'a', name: 'Dagger', ability: 'dex', proficient: true, damageDice: '1d4', damageType: 'Piercing', addModToDamage: true }],
    speed: 30,
  }
  const plain = deriveSheet(base)

  it('no buffs: same numbers as before', () => {
    expect(plain.buffs).toEqual(buffTotals())
    expect(plain.speed).toBe(30)
    expect(plain.skills.Perception).toBe(4) // WIS +2, PB +2
  })

  it('Longstrider: Speed +10 ft.', () => {
    expect(deriveSheet({ ...base, buffs: [longstrider] }).speed).toBe(40)
  })

  it('a skill check bonus raises every skill and the passive scores, not saves or Initiative', () => {
    const s = deriveSheet({ ...base, buffs: [blessing] })
    expect(s.skills.Perception).toBe(5)
    expect(s.skills.Athletics).toBe(plain.skills.Athletics + 1)
    expect(s.passivePerception).toBe(plain.passivePerception + 1)
    expect(s.saves).toEqual(plain.saves)
    expect(s.initiative).toBe(plain.initiative)
  })

  it('attack, save and Initiative buffs', () => {
    const s = deriveSheet({ ...base, buffs: [buff({ name: 'Test', mods: { attack: 1, saves: 2, initiative: 3 } })] })
    expect(s.attacks[0].hit).toBe(plain.attacks[0].hit + 1)
    expect(s.spellAttack).toBe(plain.spellAttack! + 1)
    expect(s.spellSaveDC).toBe(plain.spellSaveDC) // a DC is not an attack roll
    expect(s.saves.dex).toBe(plain.saves.dex + 2)
    expect(s.initiative).toBe(plain.initiative + 3)
  })

  it('works together with Exhaustion, and Speed never goes below 0', () => {
    const s = deriveSheet({ ...base, exhaustion: 2, buffs: [longstrider, blessing] })
    expect(s.speed).toBe(30) // 30 − 10 + 10
    expect(s.skills.Perception).toBe(4 - 4 + 1)
    expect(deriveSheet({ ...base, buffs: [buff({ name: 'Slow', mods: { speed: -40 } })] }).speed).toBe(0)
  })
})
