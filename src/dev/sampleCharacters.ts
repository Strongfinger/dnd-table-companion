// DEV ONLY: turns the real test characters into saved Characters for trying out the UI.
// Only loaded through a dynamic import behind import.meta.env.DEV, so it never ships.
import { createCharacter, type Character } from '../model/character'
import { ALL_FIXTURES } from '../rules/fixtures/characters'

export function sampleCharacters(): Character[] {
  return ALL_FIXTURES.map((f) => {
    const { expected, hpRolls: _rolls, hpBonusPerLevel: _bonus, ...fields } = f
    return createCharacter({
      ...fields,
      hp: { max: expected.maxHp, current: expected.maxHp, temp: 0 },
      ac: expected.ac,
    })
  })
}
