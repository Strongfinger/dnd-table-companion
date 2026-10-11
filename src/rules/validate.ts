/** Throw if `value` isn't a whole number between min and max (inclusive). Catches bad input early. */
export function assertIntInRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be a whole number from ${min} to ${max}, got ${value}`)
  }
}
