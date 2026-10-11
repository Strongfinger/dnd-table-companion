// Dice rolling. `rng` can be swapped in tests to get predictable rolls.
export type Rng = () => number

/** Roll one die with `sides` faces: 1..sides. */
export function rollDie(sides: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * sides) + 1
}
