// Test bench for the live lobby (Step B): create or join a room, see who's online,
// send test messages. Not the final lobby UI (that's Phase 4).
import { useEffect, useRef, useState } from 'react'
import { currentDevice } from '../db/device'
import { parseRollEvent, rollEventText, type RollEvent } from '../model/rollEvent'
import { formatDice, parseDice, rollDice } from '../rules'
import { makeEnvelope, type Envelope } from '../sync/envelope'
import { firebaseTransport } from '../sync/firebaseTransport'
import { localTransport } from '../sync/localTransport'
import { isValidRoomCode, newRoomCode, normalizeRoomCode } from '../sync/roomCode'
import type { ConnectionStatus, Member, RoomConnection, RoomTransport } from '../sync/transport'
import { Button, Section, TextInput } from '../ui/kit'

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: '⏳ กำลังเชื่อมต่อ…',
  connected: '🟢 เชื่อมต่อแล้ว',
  reconnecting: '🟠 สัญญาณหลุด กำลังเชื่อมต่อใหม่…',
  offline: '⚪ ไม่ได้เชื่อมต่อ',
}

/** Each tab pretends to be its own device in the local test, so two tabs = two players. */
function tabDevice(base: { id: string; name: string }) {
  let tab = sessionStorage.getItem('lab-tab')
  if (!tab) {
    tab = Math.random().toString(36).slice(2, 6)
    sessionStorage.setItem('lab-tab', tab)
  }
  return { id: `${base.id}-tab-${tab}`, name: `${base.name} (แท็บ ${tab})` }
}

export default function LobbyLab() {
  const online = firebaseTransport()
  const [mode, setMode] = useState<'local' | 'firebase'>('local')
  const [role, setRole] = useState<'dm' | 'player'>('dm')
  const [codeInput, setCodeInput] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('offline')
  const [members, setMembers] = useState<Member[]>([])
  const [messages, setMessages] = useState<string[]>([])
  // The open connection (used in event handlers) and its room code (shown on screen).
  const conn = useRef<RoomConnection | null>(null)
  const [code, setCode] = useState<string | null>(null)

  const device = currentDevice() ?? { id: 'unknown', name: 'อุปกรณ์' }
  const me = mode === 'local' ? tabDevice(device) : device

  const note = (line: string) => setMessages((old) => [`${new Date().toLocaleTimeString('th-TH')} ${line}`, ...old].slice(0, 100))

  function onMessage(e: Envelope) {
    if (e.kind === 'roll') {
      const roll = parseRollEvent(e.body)
      if (roll) note(rollEventText({ ...roll, by: e.fromName })) // the connection says who rolled
      else note(`⚠️ ทิ้งข้อความทอยเต๋าที่ไม่ถูกต้องจาก ${e.fromName}`)
    } else {
      note(`📨 ${e.kind} จาก ${e.fromName}`)
    }
  }

  function join(code: string) {
    const transport: RoomTransport | null = mode === 'local' ? localTransport() : online
    if (!transport) return
    conn.current?.leave()
    conn.current = transport.join(code, { id: me.id, name: me.name, role, characterId: null }, {
      onMessage,
      onMembers: setMembers,
      onStatus: setStatus,
    })
    setCode(code)
    note(`เข้าห้อง ${code} (${transport.label}) เป็น ${role === 'dm' ? 'DM' : 'ผู้เล่น'}`)
  }

  function leave() {
    conn.current?.leave()
    conn.current = null
    setCode(null)
    setMembers([])
    note('ออกจากห้องแล้ว')
  }

  useEffect(() => () => conn.current?.leave(), [])

  function sendRoll() {
    const expr = parseDice('d20+5')!
    const r = rollDice(expr)
    const roll: RollEvent = { type: 'roll', by: me.name, expression: formatDice(expr), mode: 'normal', critical: false, total: r.total, faces: r.rolls, natural: r.rolls[0][0] === 20 ? 20 : r.rolls[0][0] === 1 ? 1 : null }
    conn.current?.send(makeEnvelope('roll', roll, me))
    note(`ส่ง: ${rollEventText(roll)}`)
  }

  function sendPing() {
    conn.current?.send(makeEnvelope('ping', null, me))
    note('ส่ง: ping')
  }

  const typed = normalizeRoomCode(codeInput)

  return (
    <div className="space-y-4">
      <a href="#/about" className="text-sm text-stone-400">← เกี่ยวกับแอป</a>
      <header>
        <h1 className="text-2xl font-bold text-amber-400">🧪 ทดลองห้องเล่นร่วมกัน</h1>
        <p className="text-sm text-stone-400">หน้าทดสอบการเชื่อมต่อ (ยังไม่ใช่ล็อบบี้จริง) · โหมดในเครื่อง: เปิด 2 แท็บ แท็บหนึ่งเป็น DM อีกแท็บเป็นผู้เล่น</p>
      </header>

      {!code && (
        <Section title="ตั้งค่า">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <button type="button" onClick={() => setMode('local')} className={`rounded-full border px-3 py-1 ${mode === 'local' ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>ในเครื่อง (หลายแท็บ)</button>
              <button type="button" disabled={!online} onClick={() => setMode('firebase')} className={`rounded-full border px-3 py-1 disabled:opacity-40 ${mode === 'firebase' ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>
                ออนไลน์ (Firebase){!online && ' · ยังไม่ได้ตั้งค่า'}
              </button>
            </div>
            <div className="flex gap-2 text-sm">
              <button type="button" onClick={() => setRole('dm')} className={`flex-1 rounded-lg border px-3 py-2 ${role === 'dm' ? 'border-amber-400 bg-stone-700 font-bold' : 'border-stone-600'}`}>🎲 DM: สร้างห้อง</button>
              <button type="button" onClick={() => setRole('player')} className={`flex-1 rounded-lg border px-3 py-2 ${role === 'player' ? 'border-amber-400 bg-stone-700 font-bold' : 'border-stone-600'}`}>🧑 ผู้เล่น: เข้าห้อง</button>
            </div>
            <p className="text-xs text-stone-500">ชื่อที่คนอื่นเห็น: {me.name}</p>
            {role === 'dm' ? (
              <Button variant="primary" className="w-full" onClick={() => join(newRoomCode())}>สร้างห้องใหม่</Button>
            ) : (
              <div className="flex gap-2">
                <div className="flex-1"><TextInput value={codeInput} placeholder="รหัสห้อง 6 ตัว เช่น K7QX4M" onChange={setCodeInput} /></div>
                <Button variant="primary" className={isValidRoomCode(typed) ? '' : 'opacity-40'} onClick={() => isValidRoomCode(typed) && join(typed)}>เข้าห้อง</Button>
              </div>
            )}
          </div>
        </Section>
      )}

      {code && (
        <Section title={`ห้อง ${code}`} action={<Button className="text-sm" onClick={leave}>ออกจากห้อง</Button>}>
          <p className="mb-2 text-sm">{STATUS_TEXT[status]}</p>
          <div className="mb-3 rounded-lg bg-stone-900 p-3 text-center">
            <div className="text-xs text-stone-400">รหัสห้อง (ให้ผู้เล่นพิมพ์)</div>
            <div className="font-mono text-3xl font-bold tracking-widest text-amber-400">{code}</div>
          </div>
          <div className="mb-3">
            <div className="mb-1 text-sm text-stone-400">ในห้อง ({members.length})</div>
            <ul className="space-y-1 text-sm">
              {members.map((m) => (
                <li key={m.deviceId} className="flex justify-between rounded bg-stone-900 px-2 py-1">
                  <span>{m.online ? '🟢' : '⚪'} {m.name}{m.deviceId === me.id && ' (ฉัน)'}</span>
                  <span className="text-stone-400">{m.role === 'dm' ? 'DM' : 'ผู้เล่น'}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={sendRoll}>🎲 ส่งทอย d20+5</Button>
            <Button className="flex-1" onClick={sendPing}>📨 ส่ง ping</Button>
          </div>
        </Section>
      )}

      <Section title="ข้อความ">
        {messages.length === 0 && <p className="text-sm text-stone-500">ยังไม่มี</p>}
        <ul className="space-y-0.5 text-sm">{messages.map((m, i) => <li key={i}>{m}</li>)}</ul>
      </Section>
    </div>
  )
}
