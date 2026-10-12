// The live lobby (Phase 4): the DM opens a room for a campaign, players join with the
// room code (typed, or by scanning the QR code) and pick their character.
// Shows who is in the room and online; the DM can remove a player and let them back in.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { renderSVG } from 'uqr'
import { useLobby } from '../app/useLobby'
import { listCampaigns } from '../db/campaigns'
import { listCharacters } from '../db/characters'
import { currentDevice, getSetting, setDeviceName } from '../db/device'
import { joinLink, visibleMembers } from '../sync/lobby'
import { isValidRoomCode, normalizeRoomCode } from '../sync/roomCode'
import type { ConnectionStatus } from '../sync/transport'
import CampaignPicker, { ALL } from '../ui/CampaignPicker'
import { Button, Section, TextInput } from '../ui/kit'

const STATUS_TEXT: Record<ConnectionStatus, string> = {
  connecting: '⏳ กำลังเชื่อมต่อ…',
  connected: '🟢 เชื่อมต่อแล้ว',
  reconnecting: '🟠 สัญญาณหลุด กำลังเชื่อมต่อใหม่…',
  offline: '⚪ ไม่ได้เชื่อมต่อ',
}

export default function Lobby({ code: linkCode }: { code: string | null }) {
  const lobby = useLobby()
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-amber-400">🌐 ห้องเล่นร่วมกัน</h1>
        <p className="text-sm text-stone-400">DM เปิดห้อง ผู้เล่นใส่รหัสห้องหรือสแกน QR แล้วเลือกตัวละคร (ต้องใช้อินเทอร์เน็ตระหว่างเล่น)</p>
      </header>
      {lobby.kickedNotice && <p className="rounded-lg bg-red-950 p-3 text-sm text-red-200">🚪 {lobby.kickedNotice}</p>}
      {lobby.session && linkCode && linkCode !== lobby.session.code && (
        <p className="rounded-lg bg-amber-950 p-3 text-sm text-amber-200">ลิงก์นี้เป็นของห้อง {linkCode} แต่คุณอยู่ในห้อง {lobby.session.code} อยู่ · กด "ออกจากห้อง" ก่อนเพื่อเข้าห้องใหม่</p>
      )}
      {lobby.session ? <InRoom /> : <Start linkCode={linkCode} />}
    </div>
  )
}

/** Not in a room yet: set my name, then open a room (DM) or join one (player). */
function Start({ linkCode }: { linkCode: string | null }) {
  const lobby = useLobby()
  const characters = useLiveQuery(listCharacters) ?? []
  const [name, setName] = useState(currentDevice()?.name ?? '')
  const [campaignId, setCampaignId] = useState(ALL)
  useEffect(() => {
    getSetting<string>('currentCampaignId').then((id) => id && setCampaignId(id))
  }, [])
  const [codeInput, setCodeInput] = useState(linkCode ?? '')
  const [characterId, setCharacterId] = useState('')
  // Test mode (two browser tabs on this computer): for development, or if Firebase isn't set up.
  const [local, setLocal] = useState(!lobby.onlineAvailable)
  const typed = normalizeRoomCode(codeInput)
  const character = characters.find((c) => c.id === characterId)

  // Save the name first so the room shows it.
  const saveName = () => setDeviceName(name).then((d) => setName(d.name))

  return (
    <>
      <Section title="ชื่อของฉัน">
        <p className="mb-2 text-xs text-stone-400">ชื่อที่คนอื่นในห้องเห็น</p>
        <TextInput value={name} placeholder="เช่น ต้น (DM)" onChange={setName} />
      </Section>

      <Section title="🎲 DM: เปิดห้อง">
        <p className="mb-2 text-xs text-stone-400">ห้องเป็นการเล่นสดของแคมเปญหนึ่ง เลือกหรือสร้างแคมเปญก่อน</p>
        <CampaignPicker value={campaignId} onChange={setCampaignId} />
        <Button
          variant="primary"
          className={`mt-3 w-full ${campaignId === ALL ? 'opacity-40' : ''}`}
          onClick={() => campaignId !== ALL && saveName().then(() => lobby.create(campaignId, local))}
        >
          เปิดห้องใหม่
        </Button>
      </Section>

      <Section title="🧑 ผู้เล่น: เข้าห้อง">
        <div className="space-y-2">
          <TextInput value={codeInput} placeholder="รหัสห้อง 6 ตัว เช่น K7QX4M" onChange={setCodeInput} />
          <select
            className="w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base"
            aria-label="ตัวละคร"
            value={characterId}
            onChange={(e) => setCharacterId(e.target.value)}
          >
            <option value="">— เลือกตัวละคร (เลือกทีหลังได้) —</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name || 'ไม่มีชื่อ'}</option>)}
          </select>
          <Button
            variant="primary"
            className={`w-full ${isValidRoomCode(typed) ? '' : 'opacity-40'}`}
            onClick={() => isValidRoomCode(typed) && saveName().then(() => lobby.join(typed, character ? { id: character.id, name: character.name } : null, local))}
          >
            เข้าห้อง
          </Button>
        </div>
      </Section>

      {(import.meta.env.DEV || !lobby.onlineAvailable) && (
        <label className="flex items-center gap-2 text-sm text-stone-400">
          <input type="checkbox" checked={local} disabled={!lobby.onlineAvailable} onChange={(e) => setLocal(e.target.checked)} />
          โหมดทดสอบในเครื่อง (หลายแท็บ ไม่ใช้อินเทอร์เน็ต){!lobby.onlineAvailable && ' · ยังไม่ได้ตั้งค่า Firebase'}
        </label>
      )}
    </>
  )
}

/** In a room: code + QR (DM), status, who's here, my character (player). */
function InRoom() {
  const lobby = useLobby()
  const s = lobby.session!
  const campaigns = useLiveQuery(listCampaigns) ?? []
  const characters = useLiveQuery(listCharacters) ?? []
  const campaign = campaigns.find((c) => c.id === s.campaignId)
  const link = joinLink(window.location.origin + window.location.pathname, s.code)
  const shown = visibleMembers(lobby.members, s.kicked)

  return (
    <>
      <Section title={s.role === 'dm' ? `ห้องของฉัน${campaign ? ` · 🗺 ${campaign.name}` : ''}` : 'ฉันอยู่ในห้อง'} action={<Button className="text-sm" onClick={lobby.leave}>ออกจากห้อง</Button>}>
        <p className="mb-2 text-sm">{STATUS_TEXT[lobby.status]}{s.local && ' · โหมดทดสอบในเครื่อง'}</p>
        <div className="rounded-lg bg-stone-900 p-3 text-center">
          <div className="text-xs text-stone-400">รหัสห้อง{s.role === 'dm' && ' (ให้ผู้เล่นพิมพ์ หรือสแกน QR)'}</div>
          <div className="font-mono text-4xl font-bold tracking-widest text-amber-400">{s.code}</div>
          {s.role === 'dm' && (
            <>
              {/* QR codes need dark squares on white to scan reliably, even in a dark theme. */}
              <div
                className="mx-auto mt-3 w-48 rounded-lg bg-white p-2"
                role="img"
                aria-label={`QR code: ${link}`}
                dangerouslySetInnerHTML={{ __html: renderSVG(link, { border: 1 }) }}
              />
              <div className="mt-1 break-all text-xs text-stone-500">{link}</div>
            </>
          )}
        </div>
      </Section>

      {s.role === 'player' && (
        <Section title="ตัวละครของฉันในห้องนี้">
          <select
            className="w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base"
            aria-label="ตัวละคร"
            value={s.characterId ?? ''}
            onChange={(e) => {
              const c = characters.find((x) => x.id === e.target.value)
              lobby.pickCharacter(c ? { id: c.id, name: c.name } : null)
            }}
          >
            <option value="">— ยังไม่ได้เลือก —</option>
            {characters.map((c) => <option key={c.id} value={c.id}>{c.name || 'ไม่มีชื่อ'}</option>)}
          </select>
        </Section>
      )}

      <Section title={`ในห้อง (${shown.filter((m) => m.online).length} ออนไลน์)`}>
        <ul className="space-y-1 text-sm">
          {shown.map((m) => (
            <li key={m.deviceId} className="flex items-center gap-2 rounded bg-stone-900 px-2 py-1.5">
              <span title={m.online ? 'ออนไลน์' : 'ออฟไลน์'}>{m.online ? '🟢' : '⚪'}</span>
              <span className="min-w-0 flex-1">
                <span className={m.online ? '' : 'text-stone-500'}>{m.name}</span>
                {m.deviceId === lobby.me.id && <span className="text-stone-500"> (ฉัน)</span>}
                {m.role === 'player' && (
                  <span className="block text-xs text-stone-400">{m.characterName ? `เล่นเป็น ${m.characterName}` : 'ยังไม่ได้เลือกตัวละคร'}</span>
                )}
              </span>
              <span className="text-xs text-stone-400">{m.role === 'dm' ? 'DM' : 'ผู้เล่น'}</span>
              {s.role === 'dm' && m.role === 'player' && (
                <button type="button" className="rounded px-2 py-1 text-xs text-red-300 hover:bg-red-950" onClick={() => lobby.kick(m.deviceId)}>
                  นำออก
                </button>
              )}
            </li>
          ))}
        </ul>
        {s.role === 'dm' && s.kicked.length > 0 && (
          <div className="mt-3">
            <div className="mb-1 text-xs text-stone-500">นำออกแล้ว</div>
            <ul className="space-y-1 text-sm">
              {s.kicked.map((m) => (
                <li key={m.deviceId} className="flex items-center justify-between rounded bg-stone-900 px-2 py-1 text-stone-500">
                  <span>{m.name || 'ไม่มีชื่อ'}</span>
                  <button type="button" className="rounded px-2 py-1 text-xs text-amber-300 hover:bg-stone-800" onClick={() => lobby.readmit(m.deviceId)}>
                    ให้กลับเข้าห้อง
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>
    </>
  )
}
