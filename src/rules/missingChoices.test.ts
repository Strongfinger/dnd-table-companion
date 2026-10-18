import { describe, expect, it } from 'vitest'
import { missingChoices, type MissingChoiceInput } from './missingChoices'

const base: MissingChoiceInput = { className: 'Wizard', subclass: '', level: 1, species: 'Elf', filledSlots: [] }
const kinds = (c: Partial<MissingChoiceInput>) => missingChoices({ ...base, ...c }).map((m) => `${m.kind}-${m.level}`)

describe('missing subclass / Ability Score Improvement (2024)', () => {
  it('nothing is missing before level 3', () => {
    expect(kinds({ level: 1 })).toEqual([])
    expect(kinds({ level: 2 })).toEqual([])
  })

  it('subclass is due at level 3 for every class', () => {
    expect(kinds({ level: 3 })).toEqual(['subclass-3'])
    expect(kinds({ level: 3, subclass: 'Evoker' })).toEqual([])
    expect(kinds({ level: 3, subclass: '   ' })).toEqual(['subclass-3'])
    // Homebrew subclass names count as chosen.
    expect(kinds({ className: 'Rogue', level: 3, subclass: 'Swashbuckler' })).toEqual([])
    expect(missingChoices({ ...base, level: 3 })[0].message).toBe('ยังไม่ได้เลือก Subclass (Level 3)')
  })

  it('Ability Score Improvement at 4, 8, 12, 16 and Epic Boon at 19', () => {
    expect(kinds({ level: 4, subclass: 'Evoker' })).toEqual(['asi-4'])
    expect(kinds({ level: 4, subclass: 'Evoker', filledSlots: ['background', 'asi-4'] })).toEqual([])
    expect(kinds({ level: 8, subclass: 'Evoker', filledSlots: ['asi-4'] })).toEqual(['asi-8'])
    expect(kinds({ level: 20, subclass: 'Evoker', filledSlots: ['asi-4', 'asi-8', 'asi-12', 'asi-16'] })).toEqual(['epicBoon-19'])
    expect(missingChoices({ ...base, level: 4, subclass: 'Evoker' })[0].message).toBe('ยังไม่ได้เลือก Ability Score Improvement (Level 4)')
  })

  it('extra levels: Fighter 6 and 14, Rogue 10', () => {
    expect(kinds({ className: 'Fighter', subclass: 'Champion', level: 14 })).toEqual(['asi-4', 'asi-6', 'asi-8', 'asi-12', 'asi-14'])
    expect(kinds({ className: 'Rogue', subclass: 'Thief', level: 10, filledSlots: ['asi-4', 'asi-8'] })).toEqual(['asi-10'])
  })

  it('ignores Origin and Fighting Style slots (other warnings cover those)', () => {
    expect(kinds({ className: 'Fighter', species: 'Human', level: 2 })).toEqual([])
  })
})
