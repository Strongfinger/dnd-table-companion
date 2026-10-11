// Challenge Rating → XP (2024 rules / SRD 5.2.1).

const XP_BY_CR: Record<string, number> = {
  '0.125': 25, '0.25': 50, '0.5': 100, '1': 200, '2': 450, '3': 700, '4': 1100, '5': 1800, '6': 2300,
  '7': 2900, '8': 3900, '9': 5000, '10': 5900, '11': 7200, '12': 8400, '13': 10000, '14': 11500, '15': 13000,
  '16': 15000, '17': 18000, '18': 20000, '19': 22000, '20': 25000, '21': 33000, '22': 41000, '23': 50000,
  '24': 62000, '25': 75000, '26': 90000, '27': 105000, '28': 120000, '29': 135000, '30': 155000,
}

/**
 * XP for a Challenge Rating. CR 0 is 0 or 10 XP depending on the creature
 * (10 if it has an effective attack), so the stat block decides; this returns 10.
 */
export function xpForCR(cr: number): number {
  if (cr === 0) return 10
  const xp = XP_BY_CR[String(cr)]
  if (xp === undefined) throw new RangeError(`not a Challenge Rating: ${cr}`)
  return xp
}

/** Is this XP correct for this CR? (CR 0 accepts 0 or 10.) */
export function xpMatchesCR(cr: number, xp: number): boolean {
  return cr === 0 ? xp === 0 || xp === 10 : xpForCR(cr) === xp
}
