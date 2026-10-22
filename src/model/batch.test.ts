import { describe, expect, it } from 'vitest'
import { applyCharacterAction } from './characterActions'
import { createCharacter } from './character'
import { combatantFromCharacter, createMonsters, type Combatant } from './encounter'
import {
  baseName, groupChips, planCondition, planHp, planUndo, rangeIds, readVitals, sameVitals, snapshotsOf, toggleGroup, withCondition,
  type BatchTarget,
} from './batch'

const goblins = createMonsters({ name: 'Goblin', ac: 15, hpMax: 7, initBonus: 2 }, 3)
const wolves = createMonsters({ name: 'Wolf', ac: 13, hpMax: 11, initBonus: 2 }, 2)
const hero = createCharacter({ name: 'Mira', className: 'Fighter', level: 1, hp: { max: 12, current: 12, temp: 0 } })
const heroRow = combatantFromCharacter(hero)
const monster = (c: Combatant): BatchTarget => ({ combatant: c })

describe('planHp: damage', () => {
  it('applies one number to every target and shows before/after (3 goblins, 8 damage)', () => {
    const [a, b, c] = goblins.map(monster)
    c.combatant = { ...c.combatant, hp: { max: 20, current: 20, temp: 0 } } // a tougher third one
    const plans = planHp('damage', [a, b, c], 8)
    expect(plans.map((p) => [p.before.current, p.after.current, p.outcome])).toEqual([[7, 0, 'down'], [7, 0, 'down'], [20, 12, 'hurt']])
  })

  it('temp HP absorbs first', () => {
    const t = monster({ ...goblins[0], hp: { max: 7, current: 7, temp: 3 } })
    const [p] = planHp('damage', [t], 5)
    expect(p.after).toEqual({ current: 5, temp: 0 })
  })

  it('half damage rounds down: 8 → 4, 7 → 3', () => {
    const t = monster({ ...goblins[0], hp: { max: 30, current: 30, temp: 0 } })
    expect(planHp('damage', [t], 8, { [goblins[0].id]: 'half' })[0]).toMatchObject({ amount: 4, mode: 'half' })
    expect(planHp('damage', [t], 7, { [goblins[0].id]: 'half' })[0].after.current).toBe(27)
  })

  it('half of 1 is 0: nothing changes', () => {
    const [p] = planHp('damage', [monster(goblins[0])], 1, { [goblins[0].id]: 'half' })
    expect(p).toMatchObject({ amount: 0, outcome: 'same', text: '' })
  })

  it('"ไม่โดน" (none) applies 0 to that creature only', () => {
    const plans = planHp('damage', goblins.map(monster), 5, { [goblins[1].id]: 'none' })
    expect(plans.map((p) => p.after.current)).toEqual([2, 7, 2])
    expect(plans[1].outcome).toBe('same')
  })

  it('a PC uses the sheet rules: drops to 0 HP (Unconscious path), massive damage kills', () => {
    const t: BatchTarget = { combatant: heroRow, character: hero }
    expect(planHp('damage', [t], 12)[0]).toMatchObject({ after: { current: 0, temp: 0 }, outcome: 'down' })
    expect(planHp('damage', [t], 30)[0].outcome).toBe('dead') // 18 left over >= max HP 12
  })

  it('a PC already at 0 HP takes a death save failure (HP stays 0)', () => {
    const down = applyCharacterAction(hero, { type: 'damage', amount: 12, critical: false })!.character
    const [p] = planHp('damage', [{ combatant: heroRow, character: down }], 3)
    expect(p.before.current).toBe(0)
    expect(p.after.current).toBe(0)
    expect(p.outcome).toBe('same')
    expect(p.text).toContain('Death Save')
  })

  it('amount 0 or junk changes nothing and never goes negative', () => {
    expect(planHp('damage', [monster(goblins[0])], 0)[0].outcome).toBe('same')
    expect(planHp('damage', [monster(goblins[0])], -5)[0].after.current).toBe(7)
    expect(planHp('damage', [monster(goblins[0])], 5.9)[0].after.current).toBe(2)
  })

  it('an empty selection gives an empty plan', () => {
    expect(planHp('damage', [], 5)).toEqual([])
  })
})

describe('planHp: zero-effect batches', () => {
  it('every target already at full HP: heal changes nothing (outcome same for all)', () => {
    expect(planHp('heal', goblins.map(monster), 5).every((p) => p.outcome === 'same')).toBe(true)
  })
  it('damage absorbed by Temp HP still changes something (outcome hurt)', () => {
    const t = monster({ ...goblins[0], hp: { max: 7, current: 7, temp: 9 } })
    expect(planHp('damage', [t], 4)[0]).toMatchObject({ outcome: 'hurt', after: { current: 7, temp: 5 } })
  })
  it('NaN or Infinity amounts change nothing', () => {
    expect(planHp('damage', [monster(goblins[0])], NaN)[0]).toMatchObject({ outcome: 'same', amount: 0 })
    expect(planHp('damage', [monster(goblins[0])], Infinity)[0].outcome).toBe('same')
  })
})

describe('planHp: heal', () => {
  it('heals up to max and brings a defeated monster back', () => {
    const down = monster({ ...goblins[0], hp: { max: 7, current: 0, temp: 0 }, defeated: true })
    const hurt = monster({ ...goblins[1], hp: { max: 7, current: 3, temp: 0 } })
    const plans = planHp('heal', [down, hurt], 20)
    expect(plans.map((p) => [p.after.current, p.outcome])).toEqual([[7, 'up'], [7, 'healed']])
  })
  it('ignores the half / none toggles', () => {
    const [p] = planHp('heal', [monster({ ...goblins[0], hp: { max: 7, current: 1, temp: 0 } })], 4, { [goblins[0].id]: 'none' })
    expect(p.after.current).toBe(5)
  })
})

describe('planCondition', () => {
  it('skips creatures that already have it (tracker effect or sheet)', () => {
    const withProne = withCondition(goblins[0], 'Prone', null)
    const sheetProne = { ...hero, conditions: ['Prone' as const] }
    const r = planCondition([monster(withProne), monster(goblins[1]), { combatant: heroRow, character: sheetProne }], 'Prone')
    expect(r.apply.map((t) => t.combatant.name)).toEqual(['Goblin 2'])
    expect(r.skipped).toEqual(['Goblin 1', 'Mira'])
  })
  it('withCondition adds a timed effect (ends at the end of the turn)', () => {
    expect(withCondition(goblins[0], 'Poisoned', 10).effects[0]).toMatchObject({ name: 'Poisoned', rounds: 10, ends: 'end' })
    expect(withCondition(goblins[0], 'Poisoned', null).effects[0].rounds).toBeNull()
  })
})

describe('undo', () => {
  const before = goblins.map(monster)
  const plans = planHp('damage', before, 8)
  const hitGoblins = goblins.map((g, i) => ({ ...g, hp: { ...g.hp, current: plans[i].after.current }, defeated: true }))
  const after = Object.fromEntries(hitGoblins.map((g) => [g.id, readVitals(g)]))

  it('keeps only creatures that really changed, with before and after', () => {
    const snaps = snapshotsOf(before, after)
    expect(snaps).toHaveLength(3)
    expect(snaps[0].before.hp.current).toBe(7)
    expect(snaps[0].after.hp.current).toBe(0)
    expect(snaps[0].before.defeated).toBe(false)
    expect(snapshotsOf(before, { ...after, [goblins[0].id]: readVitals(goblins[0]) })).toHaveLength(2)
  })

  it('restores everyone when nothing changed since', () => {
    const snaps = snapshotsOf(before, after)
    const r = planUndo(snaps, after)
    expect(r.restore).toHaveLength(3)
    expect(r.skipped).toEqual([])
  })

  it('skips a creature that changed after the batch (a PC sheet a player used), and one that left', () => {
    const down = applyCharacterAction(hero, { type: 'damage', amount: 12, critical: false })!.character
    const snaps = snapshotsOf([{ combatant: heroRow, character: hero }, ...before], {
      [heroRow.id]: readVitals(heroRow, down), ...after,
    })
    const playerHealed = applyCharacterAction(down, { type: 'heal', amount: 3 })!.character
    const now = { ...after, [heroRow.id]: readVitals(heroRow, playerHealed), [goblins[2].id]: undefined }
    const r = planUndo(snaps, now)
    expect(r.skipped).toEqual(['Mira', 'Goblin 3'])
    expect(r.restore.map((s) => s.name)).toEqual(['Goblin 1', 'Goblin 2'])
  })

  it('a PC snapshot holds HP, death saves, conditions and Concentration', () => {
    const conc = { ...hero, concentration: 'Bless' }
    const down = applyCharacterAction(conc, { type: 'damage', amount: 12, critical: false })!.character
    const [s] = snapshotsOf([{ combatant: heroRow, character: conc }], { [heroRow.id]: readVitals(heroRow, down) })
    expect(s.before).toMatchObject({ hp: { current: 12 }, concentration: 'Bless', conditions: [] })
    expect(s.after).toMatchObject({ hp: { current: 0 }, concentration: '', conditions: ['Unconscious'] })
  })

  it('condition order on a sheet does not count as a change', () => {
    const a = readVitals(heroRow, { ...hero, conditions: ['Prone', 'Stunned'] })
    const b = readVitals(heroRow, { ...hero, conditions: ['Stunned', 'Prone'] })
    expect(sameVitals(a, b)).toBe(true)
  })
})

describe('selecting', () => {
  it('baseName strips the copy number', () => {
    expect(baseName('Goblin 3')).toBe('Goblin')
    expect(baseName('Goblin Boss')).toBe('Goblin Boss')
  })
  it('group chips: monsters sharing a name, two or more, not defeated, not PCs', () => {
    const list = [...goblins, wolves[0], { ...wolves[1], defeated: true }, heroRow]
    expect(groupChips(list)).toEqual([{ label: 'Goblin ×3', ids: goblins.map((g) => g.id) }])
    expect(groupChips([...goblins, ...wolves]).map((g) => g.label)).toEqual(['Goblin ×3', 'Wolf ×2'])
  })
  it('range select covers both ends in either direction', () => {
    expect(rangeIds(['a', 'b', 'c', 'd'], 'b', 'd')).toEqual(['b', 'c', 'd'])
    expect(rangeIds(['a', 'b', 'c', 'd'], 'c', 'a')).toEqual(['a', 'b', 'c'])
    expect(rangeIds(['a', 'b'], 'zzz', 'b')).toEqual(['b'])
  })
  it('a group chip adds the group, and a second click takes it out', () => {
    expect(toggleGroup(['x'], ['a', 'b'])).toEqual(['x', 'a', 'b'])
    expect(toggleGroup(['x', 'a'], ['a', 'b'])).toEqual(['x', 'a', 'b'])
    expect(toggleGroup(['x', 'a', 'b'], ['a', 'b'])).toEqual(['x'])
  })
})
