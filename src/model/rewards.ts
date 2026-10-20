// The DM's reward pool (คลังกลาง) and players' coin requests. Pure functions; src/db/rewards.ts saves them on the
// DM's device and src/app/lobby.tsx sends them around the live room.
// - Players whose character is run by a DM (in a live room, or filed under a campaign another device runs) don't add
//   items or change coins themselves: they take items the DM put in the pool, and ask the DM for coin changes.
// - The DM's own device (and any character outside a DM's campaign) keeps the free "+ เพิ่มของ" and coin buttons.
import { gainCoins, spendCoins, type Coin } from '../rules'
import { canManageCampaign, type Campaign } from './campaign'
import { newId, type Character, type EquipSlot, type InventoryItem } from './character'
import { findItem, type SrdEquipment } from './equipment'
import { addPlainItem, addSrdItem } from './inventory'
import { setItemWeight } from './carrying'

/** One kind of item waiting in the pool: an SRD item (by id) or a custom one (name, wear slot, weight). */
export interface PoolItem {
  id: string
  name: string
  qty: number
  srdId?: string
  wear?: EquipSlot
  weight?: number
}

/** Most kinds of item in the pool at once (keeps the room message small). */
export const MAX_POOL_ITEMS = 100
const MAX_QTY = 9999

/** Put an item in the pool, or more of the same one (same SRD item, or same custom name, slot and weight). */
export function addToPool(pool: PoolItem[], item: Omit<PoolItem, 'id'>): PoolItem[] {
  const name = item.name.trim().slice(0, 200)
  const qty = Math.min(MAX_QTY, Math.floor(item.qty))
  if (!name || !(qty >= 1)) return pool
  const same = pool.find((p) => p.srdId === item.srdId && (item.srdId ? true : p.name === name && p.wear === item.wear && p.weight === item.weight))
  if (same) return pool.map((p) => (p === same ? { ...p, qty: Math.min(MAX_QTY, p.qty + qty) } : p))
  if (pool.length >= MAX_POOL_ITEMS) return pool
  const extra = { ...(item.srdId ? { srdId: item.srdId } : {}), ...(item.wear ? { wear: item.wear } : {}), ...(item.weight ? { weight: item.weight } : {}) }
  return [...pool, { id: newId(), name, qty, ...extra }]
}

/** Set how many of a pool item are left (0 takes it out of the pool). */
export function setPoolQty(pool: PoolItem[], id: string, qty: number): PoolItem[] {
  const n = Math.max(0, Math.min(MAX_QTY, Math.floor(qty)))
  return n === 0 ? pool.filter((p) => p.id !== id) : pool.map((p) => (p.id === id ? { ...p, qty: n } : p))
}

/** Take up to `qty` of a pool item: what was taken (null if it's gone) and the pool left. */
export function takeFromPool(pool: PoolItem[], id: string, qty: number): { taken: PoolItem | null; pool: PoolItem[] } {
  const item = pool.find((p) => p.id === id)
  const want = Math.floor(qty)
  if (!item || !(want >= 1)) return { taken: null, pool }
  const n = Math.min(item.qty, want)
  return { taken: { ...item, qty: n }, pool: setPoolQty(pool, id, item.qty - n) }
}

/**
 * Put what was taken from the pool in a character's inventory. A pack (e.g. Explorer's Pack) adds what's inside,
 * once per pack; a custom item keeps its wear slot and weight.
 */
export function receivePoolItem(c: Character, item: PoolItem, data: SrdEquipment | null): Character {
  const srd = item.srdId && data ? findItem(data, item.srdId) : undefined
  if (srd && data) {
    if (srd.kind !== 'pack') return addSrdItem(c, srd, data, item.qty)
    let next = c
    for (let i = 0; i < item.qty; i++) next = addSrdItem(next, srd, data)
    return next
  }
  return addCustomItem(c, item.name, item.qty, item.wear, item.weight)
}

/** A custom item by name (and its weight on the new entry; a same-named one may have stacked instead). */
export function addCustomItem(c: Character, name: string, qty: number, wear?: EquipSlot, weight?: number): Character {
  const next = addPlainItem(c, name, qty, wear)
  const added = next.inventory.find((i) => !c.inventory.some((o) => o.id === i.id))
  return added && weight ? setItemWeight(next, added.id, weight) : next
}

/** A pool list from the network (players get it from the DM). Null = invalid. */
export function parsePool(body: unknown): PoolItem[] | null {
  const list = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).items : null
  if (!Array.isArray(list) || list.length > MAX_POOL_ITEMS) return null
  const items: PoolItem[] = []
  for (const x of list) {
    if (typeof x !== 'object' || x === null) return null
    const p = x as Record<string, unknown>
    if (!shortText(p.id, 64) || !shortText(p.name, 200) || !Number.isInteger(p.qty) || (p.qty as number) < 1) return null
    items.push({
      id: p.id as string, name: p.name as string, qty: Math.min(MAX_QTY, p.qty as number),
      ...(shortText(p.srdId, 64) ? { srdId: p.srdId as string } : {}),
      ...(typeof p.wear === 'string' ? { wear: p.wear as EquipSlot } : {}),
      ...(typeof p.weight === 'number' && p.weight > 0 ? { weight: p.weight } : {}),
    })
  }
  return items
}

/** A player's 'take' message: which character takes how many of which pool item. */
export function parseTake(body: unknown): { characterId: string; itemId: string; qty: number } | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const ok = shortText(b.characterId, 64) && shortText(b.itemId, 64) && Number.isInteger(b.qty) && (b.qty as number) >= 1 && (b.qty as number) <= MAX_QTY
  return ok ? { characterId: b.characterId as string, itemId: b.itemId as string, qty: b.qty as number } : null
}

const shortText = (v: unknown, max: number) => typeof v === 'string' && v.length > 0 && v.length <= max

// ——— Coin requests ———

export const COINS: Coin[] = ['cp', 'sp', 'ep', 'gp', 'pp']

export interface CoinRequest {
  /** The player's message id (so a re-sent request is only listed once). */
  id: string
  characterId: string
  characterName: string
  kind: 'gain' | 'spend'
  coin: Coin
  amount: number
  /** What it's for, e.g. "ขายดาบ" or "ค่าห้องพัก". */
  note: string
  at: number
  status: 'open' | 'approved' | 'rejected'
  /** Why the DM's device couldn't do it (e.g. not enough coins). */
  reason?: string
}

/** Most coins in one request. */
export const MAX_COIN_REQUEST = 9_999_999
/** Decided requests kept (and shown to players) besides the open ones. */
export const KEEP_DECIDED = 20
/** Open requests at most (older ones go first). */
const MAX_OPEN = 50

/** A player's 'coinRequest' message body. Null = invalid. */
export function parseCoinRequestBody(body: unknown): Pick<CoinRequest, 'characterId' | 'kind' | 'coin' | 'amount' | 'note'> | null {
  if (typeof body !== 'object' || body === null) return null
  const b = body as Record<string, unknown>
  const ok = shortText(b.characterId, 64) && (b.kind === 'gain' || b.kind === 'spend') && COINS.includes(b.coin as Coin) &&
    Number.isInteger(b.amount) && (b.amount as number) >= 1 && (b.amount as number) <= MAX_COIN_REQUEST
  if (!ok) return null
  const note = typeof b.note === 'string' ? b.note.trim().slice(0, 120) : ''
  return { characterId: b.characterId as string, kind: b.kind as CoinRequest['kind'], coin: b.coin as Coin, amount: b.amount as number, note }
}

/** Add a new request (a request already listed, e.g. sent again, is left as it is). */
export function addCoinRequest(list: CoinRequest[], r: CoinRequest): CoinRequest[] {
  if (list.some((x) => x.id === r.id)) return list
  return trimRequests([...list, r])
}

/** Keep every open request (up to a limit) and the latest decided ones. */
function trimRequests(list: CoinRequest[]): CoinRequest[] {
  const open = list.filter((r) => r.status === 'open').slice(-MAX_OPEN)
  const decided = list.filter((r) => r.status !== 'open').slice(-KEEP_DECIDED)
  return list.filter((r) => open.includes(r) || decided.includes(r))
}

/** The DM decided: mark the request (only an open one changes). */
export function decideCoinRequest(list: CoinRequest[], id: string, status: 'approved' | 'rejected', reason?: string): CoinRequest[] {
  return trimRequests(list.map((r) => (r.id === id && r.status === 'open' ? { ...r, status, ...(reason ? { reason } : {}) } : r)))
}

/** A character's coins after an approved request, or null if they can't pay it. */
export function applyCoinRequest(c: Character, r: Pick<CoinRequest, 'kind' | 'coin' | 'amount'>): Character | null {
  if (r.kind === 'gain') return { ...c, coins: gainCoins(c.coins, r.coin, r.amount) }
  const coins = spendCoins(c.coins, r.coin, r.amount)
  return coins ? { ...c, coins } : null
}

/** "รับ 50 GP" / "จ่าย 5 SP" */
export function coinRequestLabel(r: Pick<CoinRequest, 'kind' | 'coin' | 'amount'>): string {
  return `${r.kind === 'gain' ? 'รับ' : 'จ่าย'} ${r.amount.toLocaleString('en-US')} ${r.coin.toUpperCase()}`
}

/** The requests list from the DM (players show their own). Null = invalid. */
export function parseCoinRequests(body: unknown): CoinRequest[] | null {
  const list = typeof body === 'object' && body !== null ? (body as Record<string, unknown>).requests : null
  if (!Array.isArray(list) || list.length > MAX_OPEN + KEEP_DECIDED) return null
  const out: CoinRequest[] = []
  for (const x of list) {
    const base = parseCoinRequestBody(x)
    const r = x as Record<string, unknown>
    const statusOk = r?.status === 'open' || r?.status === 'approved' || r?.status === 'rejected'
    if (!base || !shortText(r.id, 64) || !statusOk || !Number.isFinite(r.at)) return null
    out.push({
      ...base, id: r.id as string, at: r.at as number, status: r.status as CoinRequest['status'],
      characterName: typeof r.characterName === 'string' ? r.characterName.slice(0, 100) : '',
      ...(typeof r.reason === 'string' ? { reason: r.reason.slice(0, 120) } : {}),
    })
  }
  return out
}

// ——— Who may add items and change coins freely ———

/**
 * Is this character run by a DM on another device, so its player takes items from the pool and asks for coins?
 * Yes when this device plays it as a player in a live room, or when it is filed under a campaign another device runs
 * (a player's phone between sessions). The DM's device, and characters outside such a campaign, stay free.
 */
export function dmRunsEconomy(opts: { playedHereAsPlayer: boolean; campaign: Pick<Campaign, 'ownerDeviceId'> | undefined; myDeviceId: string; playerInRoom: boolean }): boolean {
  if (opts.playedHereAsPlayer) return true
  return !!opts.campaign && !canManageCampaign(opts.campaign, opts.myDeviceId, opts.playerInRoom)
}

const totalQty = (items: InventoryItem[]) => items.reduce((n, i) => n + i.qty, 0)

/**
 * The DM's device got a player's sheet: the DM owns the coins (players ask for changes), and the player may
 * use up, drop, rename or equip items but not bring in more than the DM's copy has (new items come from the pool).
 */
export function keepDmEconomy(dm: Pick<Character, 'coins' | 'inventory'>, incoming: Character): Character {
  const inventory = totalQty(incoming.inventory) > totalQty(dm.inventory) ? dm.inventory : incoming.inventory
  return { ...incoming, coins: dm.coins, inventory }
}
