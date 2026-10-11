import { describe, expect, it } from 'vitest'
import { CONDITIONS } from '../rules'
import { STANDARD_ACTIONS } from './actionSuggestions'
import { GLOSSARY_TERMS, lookupTerm } from './glossary'

describe('glossary', () => {
  it('explains every condition and every standard action', () => {
    for (const c of CONDITIONS) expect(lookupTerm(c), c).not.toBeNull()
    for (const a of STANDARD_ACTIONS) expect(lookupTerm(a), a).not.toBeNull()
  })

  it('understands "Attack: Greatsword", "Magic: Bless" and "Bonus"', () => {
    expect(lookupTerm('Attack: Greatsword')?.title).toBe('Attack (Action) · Greatsword')
    expect(lookupTerm('Magic: Bless')?.title).toContain('Magic')
    expect(lookupTerm('Bonus')?.title).toBe('Bonus Action')
  })

  it('species, backgrounds and Origin feats come from the SRD data', () => {
    expect(lookupTerm('Dwarf')?.text).toContain('Dwarven Toughness')
    expect(lookupTerm('Soldier')?.text).toContain('Athletics')
    expect(lookupTerm('Alert')?.title).toBe('Alert (Feat)')
  })

  it('unknown terms have no help', () => {
    expect(lookupTerm('Flying Carpet')).toBeNull()
  })

  it('every entry has a title and some text', () => {
    for (const t of GLOSSARY_TERMS) expect(lookupTerm(t)!.text.length, t).toBeGreaterThan(10)
  })
})

describe('2024 details the help must get right', () => {
  const text = (t: string) => lookupTerm(t)!.text
  it('pins the important rules', () => {
    expect(CONDITIONS).toHaveLength(15)
    expect(STANDARD_ACTIONS).toHaveLength(12)
    expect(text('Hide')).toContain('DC 15')
    expect(text('Invisible')).toContain('Initiative')
    expect(text('Incapacitated')).toContain('Initiative')
    expect(text('Exhaustion')).toContain('−2')
    expect(text('Exhaustion')).toContain('−5 ft.')
    expect(text('Concentration')).toContain('สูงสุด 30')
    expect(text('Heroic Inspiration')).toContain('ลูกใดก็ได้')
    expect(text('Death Save')).toContain('Critical Hit = 2')
    expect(text('Critical Hit')).toContain('natural 20')
    expect(text('Bloodied')).toContain('ครึ่ง')
    expect(text('Stunned')).not.toContain('Speed 0')
  })

  it('built-in object names are not terms', () => {
    expect(lookupTerm('constructor')).toBeNull()
    expect(lookupTerm('toString')).toBeNull()
  })
})
