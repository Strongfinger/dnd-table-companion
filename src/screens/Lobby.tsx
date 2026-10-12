// The live lobby (Phase 4): the DM opens a room for a campaign, players join with the
// room code (typed, or by scanning the QR code) and pick their character.
// Shows who is in the room and online; the DM can remove a player and let them back in.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { renderSVG } from 'uqr'
import { useLobby } from '../app/useLobby'
import { listCampaigns } from '../db/campaigns'
import { listCharacters } from '../db/characters'
import { listEncounters } from '../db/encounters'
import { restParty } from '../db/play'
import { liveFight } from '../model/playerView'
import { currentDevice, getSetting, setDeviceName } from '../db/device'
import { isKicked, joinLink, visibleMembers } from '../sync/lobby'
import { playedCharacterIds } from '../sync/sheets'
import { isValidRoomCode, normalizeRoomCode } from '../sync/roomCode'
import type { ConnectionStatus } from '../sync/transport'
import CampaignPicker, { ALL } from '../ui/CampaignPicker'
import { Button, Section, TextInput } from '../ui/kit'
import PlayerViewPanel from './PlayerViewPanel'

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
  const campaign = campaigns.find((c) => c.id === lobby.campaignId)
  const encounters = useLiveQuery(listEncounters) ?? []
  const shownFight = s.role === 'dm' ? liveFight(encounters, s.campaignId) : null
  const link = joinLink(window.location.origin + window.location.pathname, s.code)
  const shown = visibleMembers(lobby.members, s.kicked)
  const leave = () => {
    if (lobby.pending > 0 && !confirm(`ยังมี ${lobby.pending} การเปลี่ยนแปลงที่ DM ยังไม่ได้รับ ออกจากห้องตอนนี้จะไม่ส่งแล้ว ออกเลยไหม?`)) return
    lobby.leave()
  }

  return (
    <>
      <Section title={s.role === 'dm' ? `ห้องของฉัน${campaign ? ` · 🗺 ${campaign.name}` : ''}` : 'ฉันอยู่ในห้อง'} action={<Button className="text-sm" onClick={leave}>ออกจากห้อง</Button>}>
        <p className="mb-2 text-sm">
          {STATUS_TEXT[lobby.status]}{s.local && ' · โหมดทดสอบในเครื่อง'}
          {s.role === 'player' && lobby.pending > 0 && ` · ⏳ รอ DM ยืนยัน ${lobby.pending} การเปลี่ยนแปลง`}
        </p>
        {/* The campaign this room plays: the DM can switch it any time (e.g. after importing a campaign pack). */}
        {s.role === 'dm' ? (
          <label className="mb-3 block text-sm">
            <span className="text-stone-400">แคมเปญที่เล่นในห้องนี้</span>
            <select
              className="mt-1 w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base"
              aria-label="แคมเปญของห้อง"
              value={s.campaignId ?? ''}
              onChange={(e) => void lobby.setCampaign(e.target.value)}
            >
              {!campaign && <option value="">(ยังไม่เลือก)</option>}
              {campaigns.map((c) => <option key={c.id} value={c.id}>🗺 {c.name}</option>)}
            </select>
          </label>
        ) : (
          campaign && <p className="mb-2 text-sm text-stone-400">🗺 แคมเปญ: <b className="text-stone-200">{campaign.name}</b> (DM เป็นคนเลือก)</p>
        )}
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

      {s.role === 'dm' && (
        <p className="rounded-lg bg-stone-900 p-3 text-sm text-stone-300">
          {shownFight
            ? <>⚔️ ผู้เล่นเห็นการต่อสู้: <a href={`#/fight/${shownFight.id}`} className="underline">{shownFight.name}</a> (รอบที่ {shownFight.round}) · มอนสเตอร์แสดงแค่สถานะคร่าวๆ</>
            : '⚔️ ผู้เล่นจะเห็นลำดับ Initiative เมื่อคุณเริ่มการต่อสู้ในแท็บ การต่อสู้'}
        </p>
      )}

      {s.role === 'dm' && <PartyRest characterIds={playedCharacterIds(lobby.members, (id) => isKicked(s.kicked, id)).filter((id) => characters.some((c) => c.id === id))} />}

      {s.role === 'player' && lobby.fight && (
        <PlayerViewPanel view={lobby.fight} title={`⚔️ ${lobby.fight.name} · รอบที่ ${lobby.fight.round}`} myCharacterIds={lobby.myCharacterIds} />
      )}

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
                  <span className="block text-xs text-stone-400">
                    {!m.characterName ? 'ยังไม่ได้เลือกตัวละคร'
                      : m.characterId && characters.some((c) => c.id === m.characterId)
                        ? <a href={`#/c/${m.characterId}`} className="underline">เล่นเป็น {m.characterName}</a>
                        : `เล่นเป็น ${m.characterName}`}
                  </span>
                )}
                {/* DM: extra characters handed to this player (set on the character's row in a fight). */}
                {s.role === 'dm' && s.grants.filter((g) => g.deviceId === m.deviceId).map((g) => (
                  <span key={g.characterId} className="block text-xs text-sky-300">
                    🎮 ควบคุม {characters.find((c) => c.id === g.characterId)?.name ?? 'ตัวละคร'}
                    <button type="button" className="ml-2 underline" onClick={() => lobby.grant(g.characterId, null)}>เอาคืน</button>
                  </span>
                ))}
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

/**
 * DM: rest everyone playing in the room. A short rest is a period: while it runs, players roll Hit
 * Dice on their phones; ending it brings back short-rest abilities. A long rest is one tap.
 */
function PartyRest({ characterIds }: { characterIds: string[] }) {
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
