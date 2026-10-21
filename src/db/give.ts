// Hand an item or coins from one character to another on this device (model/give.ts), both saved in one transaction,
// with a line in each character's log. Used by the sheet for characters saved here (e.g. on the DM's device), and by
// the DM's device for players' 'give' messages in a live room.
import { db } from './db'
import { getCharacter, updateCharacter } from './characters'
import { logCharacterEvent } from './log'
import { giftLabel, giveCoins, giveItem, type GiveRequest } from '../model/give'

/** Do it. Returns an error to show (Thai) or null when it went across. */
export async function giveNow(r: GiveRequest): Promise<string | null> {
  type Done = { error: string } | { label: string; fromName: string; toName: string }
  const result = await db.transaction('rw', db.characters, async (): Promise<Done> => {
    const from = await getCharacter(r.fromId)
    const to = await getCharacter(r.toId)
    if (!from || !to) return { error: 'ไม่พบตัวละครผู้ส่งหรือผู้รับในเครื่องนี้' }
    const done = 'itemId' in r ? giveItem(from, to, r.itemId, r.qty) : giveCoins(from, to, r.coin, r.amount)
    if (!done) return { error: 'itemId' in r ? 'ส่งไม่ได้ (ของหมดแล้ว หรือยังสวมใส่อยู่)' : `เงินไม่พอส่ง ${r.amount.toLocaleString('en-US')} ${r.coin.toUpperCase()}` }
    await updateCharacter(from.id, () => ({ character: done.from, text: '' }))
    await updateCharacter(to.id, () => ({ character: done.to, text: '' }))
    return { label: giftLabel(done.gift), fromName: from.name || 'เพื่อน', toName: to.name || 'เพื่อน' }
  })
  if ('error' in result) return result.error
  await logCharacterEvent(r.fromId, `🤝 ส่ง ${result.label} ให้ ${result.toName}`)
  await logCharacterEvent(r.toId, `🤝 ได้รับ ${result.label} จาก ${result.fromName}`)
  return null
}
