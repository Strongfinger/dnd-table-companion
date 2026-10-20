// The DM's reward pool (คลังกลาง) and players' coin requests, saved in this device's settings (model/rewards.ts).
// One pool per device: what the DM is handing out right now. Changes run in a transaction, so two players
// taking the last potion at the same moment can't both get it.
import { liveQuery } from 'dexie'
import { db } from './db'
import { loadSrdEquipment } from '../model/equipment'
import {
  addCoinRequest, applyCoinRequest, coinRequestLabel, decideCoinRequest, receivePoolItem, takeFromPool, type CoinRequest, type PoolItem,
} from '../model/rewards'
import { getCharacter, updateCharacter } from './characters'
import { logCharacterEvent } from './log'

const POOL = 'reward-pool'
const REQUESTS = 'coin-requests'

async function read<T>(key: string): Promise<T[]> {
  const v = (await db.settings.get(key))?.value
  return Array.isArray(v) ? (v as T[]) : []
}

/** Change a saved list; `fn` returns the new list and anything else the caller wants back. */
async function change<T, R>(key: string, fn: (list: T[]) => { list: T[]; result: R }): Promise<R> {
  return db.transaction('rw', db.settings, async () => {
    const before = await read<T>(key)
    const r = fn(before)
    if (r.list !== before) await db.settings.put({ key, value: r.list })
    return r.result
  })
}

function watch<T>(key: string, onChange: (list: T[]) => void): () => void {
  const sub = liveQuery(() => read<T>(key)).subscribe({ next: onChange, error: (err) => console.error('watch', key, err) })
  return () => sub.unsubscribe()
}

export const getPool = () => read<PoolItem>(POOL)
export const changePool = <R>(fn: (pool: PoolItem[]) => { list: PoolItem[]; result: R }) => change(POOL, fn)
export const updatePool = (fn: (pool: PoolItem[]) => PoolItem[]) => change<PoolItem, void>(POOL, (list) => ({ list: fn(list), result: undefined }))
export const watchPool = (onChange: (pool: PoolItem[]) => void) => watch(POOL, onChange)

export const getCoinRequests = () => read<CoinRequest>(REQUESTS)
export const changeCoinRequests = <R>(fn: (list: CoinRequest[]) => { list: CoinRequest[]; result: R }) => change(REQUESTS, fn)
export const watchCoinRequests = (onChange: (list: CoinRequest[]) => void) => watch(REQUESTS, onChange)

/**
 * A player takes items from the pool (on the DM's device): out of the pool and into the character's inventory, in one
 * go. Returns the log text, or null when nothing was taken (already gone, or the character isn't here).
 */
export async function givePoolItem(characterId: string, itemId: string, qty: number): Promise<string | null> {
  const data = await loadSrdEquipment()
  return db.transaction('rw', db.settings, db.characters, async () => {
    if (!(await getCharacter(characterId))) return null
    const taken = await changePool((pool) => {
      const r = takeFromPool(pool, itemId, qty)
      return { list: r.pool, result: r.taken }
    })
    if (!taken) return null
    await updateCharacter(characterId, (c) => ({ character: receivePoolItem(c, taken, data), text: '' }))
    return `🎁 หยิบ ${taken.name}${taken.qty > 1 ? ` ×${taken.qty}` : ''} จากคลังกลาง`
  }).then(async (text) => {
    if (text) await logCharacterEvent(characterId, text)
    return text
  })
}

/** A player's coin request reached the DM's device: list it (once). */
export async function receiveCoinRequest(r: Omit<CoinRequest, 'characterName' | 'status'>): Promise<void> {
  const c = await getCharacter(r.characterId)
  await changeCoinRequests((list) => ({ list: addCoinRequest(list, { ...r, characterName: c?.name ?? '', status: 'open' }), result: undefined }))
}

/**
 * The DM approves or turns down a coin request. Approving changes the character's coins (paying breaks bigger coins
 * and gives change). Returns an error to show when it can't be done (not enough coins, character not here).
 */
export async function decideCoinRequestNow(id: string, approve: boolean): Promise<string | null> {
  const r = (await getCoinRequests()).find((x) => x.id === id)
  if (!r || r.status !== 'open') return null
  if (!approve) {
    await changeCoinRequests((list) => ({ list: decideCoinRequest(list, id, 'rejected'), result: undefined }))
    await logCharacterEvent(r.characterId, `💰 DM ไม่อนุมัติคำขอ ${coinRequestLabel(r)}${r.note ? ` (${r.note})` : ''}`)
    return null
  }
  let error: string | null = null
  await db.transaction('rw', db.settings, db.characters, async () => {
    const found = await updateCharacter(r.characterId, (c) => {
      const next = applyCoinRequest(c, r)
      if (!next) error = `${c.name || 'ตัวละคร'} มีเงินไม่พอ${coinRequestLabel(r)}`
      return { character: next ?? c, text: '' }
    })
    if (found === null) error = 'ไม่พบตัวละครนี้ในเครื่อง'
    if (!error) await changeCoinRequests((list) => ({ list: decideCoinRequest(list, id, 'approved'), result: undefined }))
  })
  if (!error) await logCharacterEvent(r.characterId, `💰 DM อนุมัติ: ${coinRequestLabel(r)}${r.note ? ` (${r.note})` : ''}`)
  return error
}
