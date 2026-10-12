// One-page summary of every character: HP and status, defenses, conditions, resources, traits.
// Every game term has help (hover with a mouse, tap / press-and-hold on a phone).
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useLobby } from '../app/useLobby'
import { listCharacters } from '../db/characters'
import { getSetting } from '../db/device'
import { isDead, isDying } from '../model/actions'
import type { Character } from '../model/character'
import { HEALTH_LABEL, healthStatus } from '../model/playerView'
import { deriveSheet, formatModifier, hitDieSize, isSrdSpecies, SPECIES_INFO } from '../rules'
import CampaignPicker, { ALL } from '../ui/CampaignPicker'
import { Term } from '../ui/help'
import { ActionEconomyBar } from '../ui/kit'
import { CONDITION_TH } from '../ui/labels'
import type { PartyCard as RoomCard } from '../sync/party'
import { classLabel } from '../model/monsterCharacter'

const SLOT_LABEL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

export default function PartyOverview() {
  const lobby = useLobby()
  const characters = useLiveQuery(listCharacters)
  const [campaignId, setCampaignId] = useState(ALL)
  useEffect(() => {
    getSetting<string>('currentCampaignId').then((id) => id && setCampaignId(id))
  }, [])
  const shown = (campaignId === ALL ? characters : characters?.filter((c) => c.campaignId === campaignId))
    ?.slice().sort((a, b) => a.name.localeCompare(b.name))

  // A player in a live room: everyone's basic cards from the DM's device, read-only.
  if (lobby.session?.role === 'player') return <RoomParty cards={lobby.party} myCharacterIds={lobby.myCharacterIds} />

  return (
    <div className="space-y-4">
      <a href="#/" className="text-sm text-stone-400">← ตัวละครทั้งหมด</a>
      <header>
        <h1 className="text-2xl font-bold text-amber-400">👥 ภาพรวมปาร์ตี้</h1>
        <p className="text-sm text-stone-400">สรุป HP สถานะ และทรัพยากรของทุกคน · แตะการ์ดเพื่อเปิดใบตัวละคร · ชี้เมาส์/แตะคำที่ขีดเส้นใต้เพื่อดูคำอธิบาย</p>
      </header>
      <CampaignPicker value={campaignId} onChange={setCampaignId} />
      {shown?.length === 0 && <p className="text-center text-stone-500">ไม่มีตัวละครในแคมเปญนี้</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {shown?.map((c) => <PartyCard key={c.id} c={c} />)}
      </div>
    </div>
  )
}

function PartyCard({ c }: { c: Character }) {
  const s = deriveSheet(c)
  const pct = Math.round((c.hp.current / Math.max(1, c.hp.max)) * 100)
  const dead = isDead(c)
  const dying = isDying(c)
  const stable = c.hp.current === 0 && c.deathSaves.successes >= 3
  const status = healthStatus(c.hp)
  const slots = c.spellSlots.map((x, i) => ({ ...x, level: i })).filter((x) => x.max > 0)
  const traits = isSrdSpecies(c.species) ? SPECIES_INFO[c.species].traits : []

  return (
    <a href={`#/c/${c.id}`} className={`block space-y-2 rounded-xl border-2 bg-stone-800 p-3 hover:bg-stone-700 ${dead ? 'border-red-900 opacity-70' : dying ? 'border-red-500' : 'border-transparent'}`}>
      {/* Name and identity */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-bold">
            {c.name} {c.heroicInspiration && <Term name="Heroic Inspiration"><span className="text-amber-400">★</span></Term>}
          </div>
          <div className="text-xs text-stone-400">
            {classLabel(c)}
            {c.species && <> · <Term name={c.species} /></>}
            {c.background && <> · <Term name={c.background} /></>}
            {c.player && ` · ${c.player}`}
          </div>
        </div>
        <div className="text-right text-xs text-stone-400">
          <div><Term name="AC" /> <b className="text-base text-stone-100">{c.ac}</b></div>
          <div><Term name="Initiative" /> <b className="text-stone-100">{formatModifier(s.initiative)}</b></div>
        </div>
      </div>

      {/* HP and status */}
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-bold">HP {c.hp.current}/{c.hp.max}{c.hp.temp > 0 && <span className="text-sky-300"> +<Term name="Temp HP">{c.hp.temp}</Term></span>}</span>
          <span className={dead || dying ? 'text-red-300' : status === 'bloodied' ? 'text-red-300' : status === 'hurt' ? 'text-amber-300' : 'text-emerald-300'}>
            {dead ? '💀 ตาย' : stable ? <Term name="Stable">Stable</Term> : dying ? <Term name="Death Save">กำลังจะตาย</Term> : status === 'bloodied' ? <Term name="Bloodied">{HEALTH_LABEL.bloodied}</Term> : HEALTH_LABEL[status]}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded bg-stone-900">
          <div className={`h-full ${pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
        </div>
        {c.hp.current === 0 && !dead && (
          <div className="mt-1 text-xs">
            <Term name="Death Save" />: สำเร็จ {'●'.repeat(c.deathSaves.successes)}{'○'.repeat(3 - c.deathSaves.successes)} · ล้มเหลว {'●'.repeat(c.deathSaves.failures)}{'○'.repeat(3 - c.deathSaves.failures)}
          </div>
        )}
      </div>

      {/* Senses and speed */}
      <div className="flex flex-wrap gap-x-4 text-xs text-stone-300">
        <span><Term name="Speed" /> {s.speed ?? c.speed} ft.</span>
        <span><Term name="Passive Perception" /> {s.passivePerception}</span>
        {s.spellSaveDC !== null && <span><Term name="Spell Save DC" /> {s.spellSaveDC}</span>}
        <span><Term name="Hit Dice" /> d{hitDieSize(c)} {c.level - c.hitDiceSpent}/{c.level}</span>
      </div>

      {/* Conditions, exhaustion, concentration */}
      {(c.conditions.length > 0 || c.exhaustion > 0 || c.concentration) && (
        <div className="flex flex-wrap gap-1 text-xs">
          {c.conditions.map((x) => (
            <span key={x} className="rounded-full bg-red-900 px-2 py-0.5"><Term name={x}>{x} {CONDITION_TH[x]}</Term></span>
          ))}
          {c.exhaustion > 0 && (
            <span className="rounded-full bg-red-950 px-2 py-0.5 text-red-300"><Term name="Exhaustion">Exhaustion {c.exhaustion}</Term> (D20 −{s.d20Penalty})</span>
          )}
          {c.concentration && (
            <span className="rounded-full bg-violet-900 px-2 py-0.5">🔮 <Term name="Concentration">{c.concentration}</Term></span>
          )}
        </div>
      )}

      {/* This turn */}
      <ActionEconomyBar economy={c.turn} compact />

      {/* Resources left */}
      {(slots.length > 0 || c.features.length > 0) && (
        <div className="text-xs text-stone-300">
          {slots.length > 0 && (
            <div><Term name="Spell Slots" />: {slots.map((x) => `${SLOT_LABEL[x.level]} ${x.max - x.used}/${x.max}`).join(' · ')}</div>
          )}
          {c.features.length > 0 && <div>{c.features.map((f) => `${f.name} ${f.max - f.used}/${f.max}`).join(' · ')}</div>}
        </div>
      )}

      {/* Traits and feats */}
      {(traits.length > 0 || c.feats.length > 0) && (
        <div className="text-xs text-stone-400">
          {traits.length > 0 && <div>Traits: {traits.join(', ')}</div>}
          {c.feats.length > 0 && <div>Feats: {c.feats.map((f, i) => <span key={f + i}>{i > 0 && ', '}<Term name={f} /></span>)}</div>}
        </div>
      )}
    </a>
  )
}

/** Players in a room: the party as the DM's device sends it. Only my own card opens a sheet. */
function RoomParty({ cards, myCharacterIds }: { cards: RoomCard[]; myCharacterIds: string[] }) {
  return (
    <div className="space-y-4">
      <a href="#/" className="text-sm text-stone-400">← ตัวละครทั้งหมด</a>
      <header>
        <h1 className="text-2xl font-bold text-amber-400">👥 ภาพรวมปาร์ตี้</h1>
        <p className="text-sm text-stone-400">ตัวละครทุกคนในห้อง (ดูอย่างเดียว) · อัปเดตจากเครื่อง DM</p>
      </header>
      {cards.length === 0 && <p className="rounded-xl bg-stone-800 p-6 text-center text-stone-400">ยังไม่มีข้อมูลปาร์ตี้จาก DM (รอเชื่อมต่อ หรือยังไม่มีใครเลือกตัวละคร)</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((c) => <RoomPartyCard key={c.characterId} c={c} mine={myCharacterIds.includes(c.characterId)} />)}
      </div>
    </div>
  )
}

function RoomPartyCard({ c, mine }: { c: RoomCard; mine: boolean }) {
  const pct = Math.round((c.hp.current / Math.max(1, c.hp.max)) * 100)
  const status = healthStatus(c.hp)
  return (
    <div className={`space-y-2 rounded-xl border-2 bg-stone-800 p-3 ${mine ? 'border-amber-500/60' : 'border-transparent'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-bold">{c.name}{mine && <span className="ml-2 text-xs text-amber-400">(ฉัน)</span>}</div>
          <div className="text-xs text-stone-400">{c.className}</div>
        </div>
        <div className="text-right text-xs text-stone-400"><Term name="AC" /> <b className="text-base text-stone-100">{c.ac}</b></div>
      </div>
      <div>
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-bold">HP {c.hp.current}/{c.hp.max}{c.hp.temp > 0 && <span className="text-sky-300"> +<Term name="Temp HP">{c.hp.temp}</Term></span>}</span>
          <span className={status === 'down' || status === 'bloodied' ? 'text-red-300' : status === 'hurt' ? 'text-amber-300' : 'text-emerald-300'}>
            {status === 'bloodied' ? <Term name="Bloodied">{HEALTH_LABEL.bloodied}</Term> : HEALTH_LABEL[status]}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded bg-stone-900">
          <div className={`h-full ${pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      {c.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs">
          {c.conditions.map((x) => <span key={x} className="rounded-full bg-red-900 px-2 py-0.5"><Term name={x}>{x} {CONDITION_TH[x]}</Term></span>)}
        </div>
      )}
      <ActionEconomyBar economy={c.turn} compact />
      {mine && <a href={`#/c/${c.characterId}`} className="block text-sm text-amber-400 underline">เปิดใบตัวละคร</a>}
    </div>
  )
}
