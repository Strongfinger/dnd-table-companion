// What players see of a fight (no secrets): the DM's preview in the tracker, and the live view on players' phones.
import { HEALTH_LABEL, type HealthStatus, type PlayerEncounterView } from '../model/playerView'
import { Section } from '../ui/kit'
import { Term } from '../ui/help'

const HEALTH_STYLE: Record<HealthStatus, string> = {
  healthy: 'text-emerald-300',
  hurt: 'text-amber-300',
  bloodied: 'text-red-300',
  down: 'text-stone-500',
}

export default function PlayerViewPanel({ view, title = '👁 มุมมองผู้เล่น (สิ่งที่ผู้เล่นจะเห็น)', myCharacterId = null }: {
  view: PlayerEncounterView
  title?: string
  /** On a player's phone: their own character is marked "(คุณ)". */
  myCharacterId?: string | null
}) {
  return (
    <Section title={title}>
      <p className="mb-2 text-sm">
        {view.status === 'active' ? `รอบที่ ${view.round}` : view.status === 'setup' ? 'กำลังเตรียมการ' : 'จบแล้ว'}
        {view.hiddenTurn && ' · 👀 มีบางอย่างที่มองไม่เห็นกำลังเคลื่อนไหว…'}
      </p>
      <ul className="space-y-1">
        {view.combatants.map((c) => (
          <li key={c.id} className={`flex items-center justify-between rounded-lg px-3 py-2 ${c.active ? 'bg-amber-900/50 ring-1 ring-amber-400' : 'bg-stone-900'}`}>
            <span>
              <span className="mr-2 text-stone-500">{c.initiative ?? '–'}</span>
              {c.active && '▶ '}{c.kind === 'pc' ? '🧑' : '👹'} {c.name}
              {myCharacterId && c.pc?.characterId === myCharacterId && <span className="text-amber-300"> (คุณ)</span>}
              {c.effects.length > 0 && <span className="ml-2 text-xs text-red-300">{c.effects.map((e) => e.name).join(', ')}</span>}
            </span>
            {c.pc ? (
              <span className="text-sm">HP {c.pc.hp.current}/{c.pc.hp.max}</span>
            ) : (
              <span className={`text-sm ${HEALTH_STYLE[c.health]}`}>
                {c.health === 'bloodied' ? <Term name="Bloodied">{HEALTH_LABEL[c.health]}</Term> : HEALTH_LABEL[c.health]}
              </span>
            )}
          </li>
        ))}
      </ul>
      {!myCharacterId && <p className="mt-2 text-xs text-stone-500">มอนสเตอร์แสดงแค่สถานะคร่าวๆ ไม่แสดง HP/AC จริง · ตัวที่ซ่อน (🙈) ไม่แสดง</p>}
    </Section>
  )
}
