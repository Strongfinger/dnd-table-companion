// Lookup tab "📏 House rules": the group's own rules, for everyone. The DM's device shows its notebook's rule
// pages; a player's phone shows the copy the DM's device sent in the last live room (kept for offline reading).
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { getReceivedRules } from '../db/houseRules'
import { listNotes } from '../db/notes'
import { mergeRules, ownRules, searchRules } from '../model/houseRules'
import { KIND_FIELDS, RULE_STATUS } from '../model/note'
import { TextInput } from '../ui/kit'

const FIELDS = KIND_FIELDS.rule.filter((f) => f.key !== 'status')

export default function HouseRuleSearch({ isPlayer }: { isPlayer: boolean }) {
  const own = useLiveQuery(async () => ownRules(await listNotes()))
  const received = useLiveQuery(getReceivedRules)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  if (!own || !received) return <p className="text-stone-400">กำลังโหลด…</p>
  const rules = mergeRules(own, received)
  const found = searchRules(rules, query)
  return (
    <div className="space-y-3">
      <p className="text-sm text-sky-300">กฎของกลุ่มเรา (house rule) ที่ DM ตั้งไว้ ใช้แทนหรือเพิ่มจากกฎทางการของ D&D 2024</p>
      {rules.length === 0 ? (
        <p className="text-sm text-stone-500">
          {isPlayer
            ? 'ยังไม่มี house rule · เข้าห้องออนไลน์ของ DM แล้วกฎจะส่งมาที่เครื่องนี้เอง (อ่านได้แม้ออฟไลน์)'
            : 'ยังไม่มี house rule · เพิ่มได้ที่แท็บ DM → สมุดแคมเปญ → 📏 House rule แล้วผู้เล่นในห้องออนไลน์จะได้รับกฎเอง'}
        </p>
      ) : (
        <>
          <TextInput value={query} placeholder="ค้นหา เช่น ไฟ, Burning, trait" onChange={setQuery} />
          <p className="text-xs text-stone-500">พบ {found.length} ข้อ</p>
        </>
      )}
      <ul className="space-y-1.5">
        {found.map((r) => {
          const isOpen = open === r.id || found.length === 1
          return (
            <li key={r.id} className="rounded-lg bg-stone-800">
              <button type="button" onClick={() => setOpen(isOpen ? null : r.id)} className="flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left">
                <span><b>📏 {r.title}</b>{r.fields.effect && <span className="ml-2 text-xs text-stone-400">{r.fields.effect}</span>}</span>
                <span className="shrink-0 text-xs">{RULE_STATUS.find((s) => s.value === r.status)?.label}</span>
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-stone-700 px-3 py-2 text-sm">
                  <dl className="space-y-1">
                    {FIELDS.filter((f) => r.fields[f.key]).map((f) => (
                      <div key={f.key} className="flex gap-2">
                        <dt className="shrink-0 text-stone-400">{f.label}:</dt>
                        <dd>{f.choices ? f.choices.find((c) => c.value === r.fields[f.key])?.label ?? r.fields[f.key] : r.fields[f.key]}</dd>
                      </div>
                    ))}
                  </dl>
                  {r.body && <p className="whitespace-pre-wrap">{r.body}</p>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
