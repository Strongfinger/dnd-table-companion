// The combat tab on a player's phone in a live room (read-only): the DM's started fights and, for
// each, the fight log without DM secrets. Players can't create or change fights; the DM runs them.
import { useLobby } from '../app/useLobby'
import PlayerViewPanel from './PlayerViewPanel'
import { Section } from '../ui/kit'

const STATUS = { active: 'กำลังต่อสู้', ended: 'จบแล้ว' }

export function PlayerFightList() {
  const { session, fightList } = useLobby()
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold text-amber-400">การต่อสู้</h1>
        <p className="text-stone-400">การต่อสู้จาก DM ในห้อง {session?.code} · ดูอย่างเดียว (DM เป็นคนสร้างและคุมการต่อสู้)</p>
      </header>
      {fightList.length === 0 && <p className="text-center text-stone-500">ยังไม่มีการต่อสู้ที่เริ่มแล้ว</p>}
      <ul className="space-y-2">
        {fightList.map((f) => (
          <li key={f.id}>
            <a href={`#/fight/${f.id}`} className="flex items-center justify-between rounded-xl bg-stone-800 p-4 hover:bg-stone-700">
              <div>
                <div className="text-lg font-bold">{f.name}</div>
                <div className={`text-sm ${f.status === 'active' ? 'text-red-300' : 'text-stone-400'}`}>
                  {STATUS[f.status]} · {f.status === 'active' ? `รอบที่ ${f.round}` : `${f.round} รอบ`}
                </div>
              </div>
              <span className="text-stone-500">›</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PlayerFight({ id }: { id: string }) {
  const { session, fight, fightList, fightLogs } = useLobby()
  const summary = fightList.find((f) => f.id === id)
  const log = fightLogs[id] ?? []
  const rounds = new Map<number, typeof log>()
  for (const e of log) rounds.set(e.round, [...(rounds.get(e.round) ?? []), e])

  if (!summary) return <p className="text-center text-stone-400">ไม่พบการต่อสู้นี้ (อาจยังไม่ได้รับจาก DM) · <a href="#/fights" className="underline">กลับ</a></p>
  return (
    <div className="space-y-4">
      <a href="#/fights" className="text-sm text-stone-400">← การต่อสู้ทั้งหมด</a>
      <header>
        <h1 className="text-2xl font-bold text-amber-400">{summary.name}</h1>
        <p className="text-stone-400">{summary.status === 'active' ? `รอบที่ ${summary.round}` : `จบแล้ว (${summary.round} รอบ)`}</p>
      </header>
      {fight?.id === id && <PlayerViewPanel view={fight} title="⚔️ ลำดับ Initiative" myCharacterId={session?.characterId ?? null} />}
      <Section title="บันทึกการต่อสู้">
        {log.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีเหตุการณ์</p>}
        <div className="space-y-3 text-sm">
          {[...rounds.entries()].map(([round, entries]) => (
            <div key={round}>
              {round > 0 && <div className="mb-1 text-xs font-bold text-amber-400">รอบที่ {round}</div>}
              <ul className="space-y-0.5">{entries.map((x) => <li key={x.id}>{x.text}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-stone-500">แสดงเฉพาะเหตุการณ์ที่ผู้เล่นเห็นได้ (ไม่แสดง HP มอนสเตอร์และสิ่งที่ซ่อนอยู่)</p>
      </Section>
    </div>
  )
}
