// One item in a character's bag on its own page (#/c/<id>/item/<itemId>): a magic item's full text, opened from
// "อ่านเพิ่มเติม" on its card in the buffs list, which only shows the short summary.
import { useLiveQuery } from 'dexie-react-hooks'
import { goBack } from '../app/router'
import { getCharacter } from '../db/characters'
import { effectSummary } from '../model/magicItemSummary'
import { SLOT_LABEL } from '../model/inventory'
import MiniMarkdown from '../ui/MiniMarkdown'
import { useMagicItemSummaries } from './useSrdData'

export default function ItemPage({ id, itemId }: { id: string; itemId: string }) {
  // null = not found, undefined = still loading.
  const c = useLiveQuery(() => getCharacter(id).then((found) => found ?? null), [id])
  const srd = useMagicItemSummaries()
  if (c === undefined) return null
  const item = c?.inventory.find((i) => i.id === itemId)
  const back = (
    <button type="button" className="text-sm text-stone-400" onClick={() => goBack(`/c/${id}`)}>← กลับ</button>
  )
  if (!c || !item) {
    return <div className="space-y-4">{back}<p className="text-center text-stone-400">ไม่พบไอเทมนี้ (อาจถูกลบหรือย้ายไปแล้ว)</p></div>
  }
  const slot = item.slot ?? (item.equipped ? item.wear : undefined)
  return (
    <div className="space-y-4">
      {back}
      <article className="space-y-3 rounded-xl border border-violet-700 bg-stone-900 p-4 text-sm leading-relaxed">
        <header>
          <h1 className="text-2xl font-bold text-amber-400">{item.magic && '✨ '}{item.name}</h1>
          <p className="text-stone-400">
            {item.magic ? 'Magic Item' : 'ไอเทม'} ของ {c.name || '(ไม่มีชื่อ)'}
            {slot && ` · สวมที่${SLOT_LABEL[slot]}`}
            {item.qty > 1 && ` · ×${item.qty}`}
          </p>
        </header>
        {item.magic && item.description && (
          <div className="rounded-lg border border-violet-600 bg-violet-950 px-3 py-2">
            <p className="text-xs font-bold text-violet-300">สรุปเอฟเฟกต์</p>
            <p className="text-stone-100">{effectSummary({ name: item.name, summary: item.summary, description: item.description }, srd)}</p>
          </div>
        )}
        {item.description
          ? <div className="text-stone-200"><MiniMarkdown text={item.description} /></div>
          : <p className="text-stone-500">ไม่มีคำอธิบาย</p>}
      </article>
    </div>
  )
}
