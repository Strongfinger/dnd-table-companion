// DM: rest the whole party playing in the live room (shown on the DM tab). A short rest is a period: while
// it runs, players roll Hit Dice on their phones; ending it brings back short-rest abilities. A long rest is one tap.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { listCharacters } from '../db/characters'
import { restParty } from '../db/play'
import { Button, Section } from '../ui/kit'

export default function PartyRest() {
  const lobby = useLobby()
  const all = useLiveQuery(listCharacters)
  if (lobby.session?.role !== 'dm') {
    return (
      <Section title="☕🌙 พักทั้งปาร์ตี้">
        <p className="text-sm text-stone-400">เปิดห้องที่แท็บ <a href="#/lobby" className="text-amber-400 underline">🌐 ห้อง</a> ให้ผู้เล่นเข้าก่อน แล้วสั่ง Short / Long Rest ทั้งปาร์ตี้ได้ที่นี่</p>
      </Section>
    )
  }
  // Every character played in the room (handed-over ones too) that is on this device.
  const characterIds = lobby.playedIds.filter((id) => (all ?? []).some((c) => c.id === id))
  return <PartyRestBox characterIds={characterIds} />
}

function PartyRestBox({ characterIds }: { characterIds: string[] }) {
  const lobby = useLobby()
  const [confirm, setConfirm] = useState<'shortRest' | 'longRest' | null>(null)
  const [result, setResult] = useState('')
  const party = (useLiveQuery(listCharacters) ?? []).filter((c) => characterIds.includes(c.id))
  const since = lobby.shortRestSince

  const report = (kind: 'shortRest' | 'longRest', r: { rested: string[]; skipped: string[] }) =>
    setResult([
      r.rested.length ? `${kind === 'longRest' ? '🌙 Long Rest' : '☕ Short Rest'} เสร็จ: ${r.rested.join(', ')}` : '',
      r.skipped.length ? `ไม่ได้พัก: ${r.skipped.join(', ')}${kind === 'longRest' ? ' (HP 0 พักยาวไม่ได้)' : ''}` : '',
    ].filter(Boolean).join(' · '))

  async function go(kind: 'shortRest' | 'longRest') {
    setConfirm(null)
    setResult('')
    if (kind === 'shortRest') await lobby.startShortRest()
    else report('longRest', await restParty(characterIds, 'longRest'))
  }

  if (since) {
    return (
      <Section title="☕ กำลังพักสั้นทั้งปาร์ตี้">
        <p className="mb-2 text-xs text-stone-400">
          เริ่ม {new Date(since).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} · ผู้เล่นทอย Hit Dice ในมือถือเพื่อฟื้น HP ได้จนกว่าจะจบการพัก
        </p>
        <ul className="mb-3 space-y-1 text-sm">
          {party.map((c) => (
            <li key={c.id} className="flex justify-between rounded bg-stone-900 px-2 py-1">
              <span>{c.name}</span>
              <span className="text-stone-400">HP {c.hp.current}/{c.hp.max} · Hit Dice เหลือ {c.level - c.hitDiceSpent}/{c.level}</span>
            </li>
          ))}
        </ul>
        <Button variant="primary" className="w-full" onClick={async () => report('shortRest', await lobby.endShortRest())}>
          จบการพักสั้น (ความสามารถแบบ Short Rest กลับมา)
        </Button>
      </Section>
    )
  }

  return (
    <Section title="พักทั้งปาร์ตี้">
      {characterIds.length === 0 ? (
        <p className="text-sm text-stone-500">ยังไม่มีตัวละครของผู้เล่นในห้อง (รอผู้เล่นเลือกตัวละคร)</p>
      ) : (
        <>
          <p className="mb-2 text-xs text-stone-400">ทุกตัวละครที่ผู้เล่นในห้องเลือกไว้ ({characterIds.length} ตัว)</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => setConfirm(confirm === 'shortRest' ? null : 'shortRest')}>☕ เริ่มพักสั้น</Button>
            <Button className="flex-1" onClick={() => setConfirm(confirm === 'longRest' ? null : 'longRest')}>🌙 พักยาว</Button>
          </div>
          {confirm && (
            <div className="mt-2 space-y-2 rounded-lg bg-stone-900 p-3">
              <p className="text-sm">
                {confirm === 'longRest'
                  ? 'พักยาว 8 ชม.: HP, Hit Dice, Spell Slots และความสามารถทั้งหมดกลับมาเต็ม · Exhaustion −1'
                  : 'พักสั้น 1 ชม.: ระหว่างพัก ผู้เล่นทอย Hit Dice ฟื้น HP ได้ในมือถือ · กด "จบการพักสั้น" เมื่อพักเสร็จ แล้วความสามารถแบบ Short Rest (และ Spell Slots ของ Warlock) จะกลับมา'}
              </p>
              <Button variant="primary" className="w-full" onClick={() => go(confirm)}>
                {confirm === 'longRest' ? 'ยืนยันพักยาวทั้งปาร์ตี้' : 'เริ่มพักสั้นทั้งปาร์ตี้'}
              </Button>
            </div>
          )}
        </>
      )}
      {result && <p className="mt-2 rounded-lg bg-stone-900 p-2 text-sm text-amber-200">{result}</p>}
    </Section>
  )
}
