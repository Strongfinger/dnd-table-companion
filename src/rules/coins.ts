// Coins (SRD 5.2.1, "Coins"): 1 PP = 10 GP, 1 GP = 2 EP = 10 SP = 100 CP.
// Pure functions for the coin purse on the sheet: get coins, and pay with change.

export type Coin = 'cp' | 'sp' | 'ep' | 'gp' | 'pp'
export type Coins = Record<Coin, number>

/** Smallest first. */
export const COINS: Coin[] = ['cp', 'sp', 'ep', 'gp', 'pp']

/** Each coin's value in copper pieces. */
export const COIN_VALUE_CP: Record<Coin, number> = { cp: 1, sp: 10, ep: 50, gp: 100, pp: 1000 }

/** The most of one coin a character can carry in the app (same cap as the import check). */
export const MAX_COINS = 9_999_999

/** Everything in the purse, counted in CP. */
export function totalCopper(coins: Coins): number {
  return COINS.reduce((sum, k) => sum + coins[k] * COIN_VALUE_CP[k], 0)
}

/** Get `amount` coins of one kind. */
export function gainCoins(coins: Coins, coin: Coin, amount: number): Coins {
  const n = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0
  return { ...coins, [coin]: Math.min(MAX_COINS, coins[coin] + n) }
}

/**
 * Pay `amount` coins of one kind, or null if the whole purse isn't worth that much.
 * Uses that coin first; then smaller coins (they always add up evenly); then breaks bigger coins
 * and gets change, biggest coins first. Example: pay 5 SP with 0 SP and 1 GP → 5 SP left; pay 1 CP with 1 GP → 9 SP 9 CP.
 */
export function spendCoins(coins: Coins, coin: Coin, amount: number): Coins | null {
  if (!Number.isFinite(amount)) return null
  const n = Math.max(0, Math.floor(amount))
  if (totalCopper(coins) < n * COIN_VALUE_CP[coin]) return null
  const out = { ...coins }
  // What's still owed, in copper.
  let owed = n * COIN_VALUE_CP[coin]
  const pay = (k: Coin, count: number) => {
    out[k] -= count
    owed -= count * COIN_VALUE_CP[k]
  }
  pay(coin, Math.min(out[coin], n))
  const i = COINS.indexOf(coin)
  // Smaller coins, biggest first. Each one divides the coin being paid, so owed stays a whole number of them.
  for (const k of COINS.slice(0, i).reverse()) {
    if (owed > 0) pay(k, Math.min(out[k], Math.floor(owed / COIN_VALUE_CP[k])))
  }
  // Bigger coins, smallest first: hand over enough of them and take the change.
  for (const k of COINS.slice(i + 1)) {
    if (owed > 0) pay(k, Math.min(out[k], Math.ceil(owed / COIN_VALUE_CP[k])))
  }
  // Change (owed is now 0 or below), biggest coins first, like a shopkeeper. It's always less than the coin broken,
  // so it never comes back as that coin. No EP (rare) unless paying in EP.
  let change = -owed
  for (const k of COINS.slice(0, 4).reverse().filter((k) => k !== 'ep' || coin === 'ep')) {
    const back = Math.floor(change / COIN_VALUE_CP[k])
    out[k] = Math.min(MAX_COINS, out[k] + back)
    change -= back * COIN_VALUE_CP[k]
  }
  return out
}
