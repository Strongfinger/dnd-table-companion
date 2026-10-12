import { describe, expect, it } from 'vitest'
import { castingTimeLine, componentsLine, findSpellByName, loadSrdSpells, searchSpells, spellLevelLine } from './spells'

describe('SRD spells', () => {
  it('loads all 339, cantrips first', async () => {
    const all = await loadSrdSpells()
    expect(all).toHaveLength(339)
    expect(all[0].level).toBe(0)
  })

  it('searches by name, school, level and class', async () => {
    const all = await loadSrdSpells()
    expect(searchSpells(all, { query: 'fire ball', level: null, className: null }).map((s) => s.name)).toEqual(['Fireball', 'Delayed Blast Fireball'])
    const wizard3 = searchSpells(all, { query: '', level: 3, className: 'Wizard' })
    expect(wizard3.every((s) => s.level === 3 && s.classes.includes('Wizard'))).toBe(true)
    expect(wizard3.map((s) => s.name)).toContain('Counterspell')
    expect(searchSpells(all, { query: 'necromancy', level: 0, className: null }).every((s) => s.school === 'Necromancy')).toBe(true)
  })

  it('formats the card lines', async () => {
    const all = await loadSrdSpells()
    const fireball = findSpellByName(all, '  fireball ')!
    expect(spellLevelLine(fireball)).toBe('Level 3 Evocation')
    expect(componentsLine(fireball)).toBe('V, S, M (a ball of bat guano and sulfur)')
    expect(spellLevelLine({ level: 0, school: 'Evocation' })).toBe('Evocation Cantrip')
    expect(castingTimeLine({ castingTime: 'Action', ritual: true })).toBe('Action or Ritual')
    // Source correction: flagged as Concentration, duration in the usual form.
    expect(findSpellByName(all, 'Protection from Evil and Good')).toMatchObject({ concentration: true, duration: 'up to 10 minutes' })
  })
})
