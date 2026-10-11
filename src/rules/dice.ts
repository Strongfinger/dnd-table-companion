// Dice rolling. `rng` can be swapped in tests to get predictable rolls.
export type Rng = () => number

/** Roll one die with `sides` faces: 1..sides. */
export function rollDie(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1
}

/** Read a roll typed in from real dice: a whole number 1..sides, otherwise null. */
export function parseManualRoll(text: string, sides: number): number | null {
  const n = Number(text.trim())
  return Number.isInteger(n) && n >= 1 && n <= sides ? n : null
}
