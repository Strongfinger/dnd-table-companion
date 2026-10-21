// One-page summary of every character: who needs help first, party totals, then a card (or table row) per character
// with HP and status, defenses, conditions and resources. "🤝 ส่งของให้" on a card gives that friend an item or coins.
// Every game term has help (hover with a mouse, tap / press-and-hold on a phone).
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { useLobby } from '../app/useLobby'
import { getCharacter, listCharacters } from '../db/characters'
import { getSetting } from '../db/device'
import { isDead, isDying } from '../model/actions'
import type { Character } from '../model/character'
import { HEALTH_LABEL, healthStatus } from '../model/playerView'
import { needsCare, PARTY_SORTS, partyTotals, sortParty, type CareKind, type PartyMember, type PartySort } from '../model/partySummary'
import { buffedArmorClass, deriveSheet, formatModifier, hitDieSize, loadedSpeed } from '../rules'
import { characterLoad } from '../model/carrying'
import { useEquipment } from './useSrdData'
import CampaignPicker, { ALL } from '../ui/CampaignPicker'
import { Term } from '../ui/help'
import { ActionEconomyBar, HpBar } from '../ui/kit'
import { CONDITION_TH } from '../ui/labels'
import type { PartyCard as RoomCard } from '../sync/party'
import { classLabel } from '../model/monsterCharacter'
import { BuffChips } from './BuffPanel'
import { GiveSheet } from './GiveForm'

const SLOT_LABEL = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th']

/** Sort and card/table choice, remembered on this device (storage can be blocked: then the defaults). */
function useRemembered<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(key) as T | null
      if (saved && allowed.includes(saved)) return saved
    } catch { /* blocked: default */ }
    return fallback
  })
  return [value, (v: T) => {
    setValue(v)
    try { localStorage.setItem(key, v) } catch { /* not remembered, fine */ }
  }]
}

/** True on a tablet or laptop (Tailwind's md, 768 px and wider). */
function useWide() {
  const query = '(min-width: 768px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const onChange = () => setWide(m.matches)
    m.addEventListener('change', onChange)
    return () => m.removeEventListener('change', onChange)
  }, [])
  return wide
}

/** One character with the numbers the page shows, worked out once. */
interface Row extends PartyMember {
  c: Character
  ac: number
  speed: number
  heavy: boolean
  spellSaveDC: number | null
  d20Penalty: number
  passivePerception: number
  initiative: number
}

function useRows(characters: Character[] | undefined): Row[] {
  const equipment = useEquipment()
  return (characters ?? []).map((c) => {
    const s = deriveSheet(c)
    const load = characterLoad(c, equipment ?? undefined)
    const slots = c.spellSlots.filter((x) => x.max > 0)
    return {
      id: c.id,
      name: c.name || '(ไม่มีชื่อ)',
      hp: c.hp,
      deathSaves: c.deathSaves,
      c,
      ac: buffedArmorClass(c.ac, c.buffs),
      initiative: s.initiative,
      speed: loadedSpeed(s.speed ?? c.speed, load.state),
      heavy: load.state !== 'ok',
      passivePerception: s.passivePerception,
      spellSaveDC: s.spellSaveDC,
      d20Penalty: s.d20Penalty,
      slots: slots.length > 0 ? { left: slots.reduce((n, x) => n + x.max - x.used, 0), max: slots.reduce((n, x) => n + x.max, 0) } : undefined,
      hitDice: { left: c.level - c.hitDiceSpent, max: c.level },
    }
  })
}

export default function PartyOverview() {
  const lobby = useLobby()
  const characters = useLiveQuery(listCharacters)
  const [campaignId, setCampaignId] = useState(ALL)
  const [sort, setSort] = useRemembered<PartySort>('party-sort', 'name', PARTY_SORTS.map((x) => x.value))
  const [view, setView] = useRemembered<'cards' | 'table'>('party-view', 'cards', ['cards', 'table'])
  const [giveTo, setGiveTo] = useState<Character | null>(null)
  const wide = useWide()
  useEffect(() => {
    getSetting<string>('currentCampaignId').then((id) => id && setCampaignId(id))
  }, [])
  const shown = campaignId === ALL ? characters : characters?.filter((c) => c.campaignId === campaignId)
  const rows = sortParty(useRows(shown), sort)

  // A player in a live room: everyone's basic cards from the DM's device, read-only (and gifts from their own character).
  if (lobby.session?.role === 'player') return <RoomParty cards={lobby.party} myCharacterIds={lobby.myCharacterIds} sort={sort} onSort={setSort} />

  // Who can give to a character on this device: the others in the same campaign.
  const giversFor = (to: Character) => (characters ?? []).filter((x) => x.id !== to.id && (x.campaignId ?? null) === (to.campaignId ?? null))

  return (
    <div className="space-y-4">
      <a href="#/" className="text-sm text-stone-400">← ตัวละครทั้งหมด</a>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">👥 ภาพรวมปาร์ตี้</h1>
          <p className="text-sm text-stone-400">แตะชื่อเพื่อเปิดใบตัวละคร · ชี้เมาส์/แตะคำที่ขีดเส้นใต้เพื่อดูคำอธิบาย</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented label="เรียงตาม" value={sort} options={PARTY_SORTS} onChange={setSort} />
          {/* The table needs a wide screen: phones always get cards. */}
          <div className="hidden md:block"><Segmented label="มุมมอง" value={view} options={[{ value: 'cards', label: 'การ์ด' }, { value: 'table', label: 'ตาราง' }]} onChange={setView} /></div>
        </div>
      </header>
      <CampaignPicker value={campaignId} onChange={setCampaignId} />
      {rows.length === 0 && characters && <p className="text-center text-stone-500">ไม่มีตัวละครในแคมเปญนี้</p>}

      {rows.length > 0 && <Summary rows={rows} />}

      {view === 'table' && wide ? (
        <PartyTable rows={rows} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rows.map((r) => <PartyCard key={r.id} r={r} onGive={giversFor(r.c).length > 0 ? () => setGiveTo(r.c) : undefined} />)}
        </div>
      )}

      {giveTo && <GiveSheet toId={giveTo.id} toName={giveTo.name || 'เพื่อน'} givers={giversFor(giveTo)} onClose={() => setGiveTo(null)} />}
    </div>
  )
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="group" aria-label={label} className="flex gap-0.5 rounded-xl border border-stone-700 bg-stone-900 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={`min-h-9 rounded-lg px-3 text-sm ${value === o.value ? 'bg-amber-400 font-bold text-stone-900' : 'text-stone-300 hover:bg-stone-800'}`}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

const CARE_TEXT: Record<CareKind, string> = { dying: 'กำลังจะตาย', dead: 'ตายแล้ว', stable: 'Stable (HP 0)', bloodied: 'Bloodied' }

/** "ต้องดูแลก่อน" plus the party's totals. */
function Summary({ rows }: { rows: Row[] }) {
  const care = needsCare(rows)
  const t = partyTotals(rows)
  return (
    <section aria-label="สรุปปาร์ตี้" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <CareBox care={care.map(({ member, kind }) => ({ id: member.id, name: member.name, hp: member.hp, kind, deathSaves: member.deathSaves }))} />
      <div className="rounded-xl border border-stone-700 bg-stone-800 p-3">
        <div className="text-xs font-bold text-stone-400">HP รวมปาร์ตี้</div>
        <div><b className="text-2xl">{t.hp.current}</b><span className="text-stone-400"> / {t.hp.max}</span></div>
        <HpBar current={t.hp.current} max={t.hp.max} className="mt-1 h-1.5" />
      </div>
      <div className="rounded-xl border border-stone-700 bg-stone-800 p-3 text-sm">
        <div className="text-xs font-bold text-stone-400"><Term name="Passive Perception" /></div>
        {t.lowestPerception && <div>ต่ำสุด <b className="text-xl">{t.lowestPerception.value}</b> {t.lowestPerception.name}</div>}
        {t.highestPerception && <div className="text-stone-400">สูงสุด {t.highestPerception.value} {t.highestPerception.name}</div>}
      </div>
      <div className="col-span-2 rounded-xl border border-stone-700 bg-stone-800 p-3 text-sm lg:col-span-1">
        <div className="text-xs font-bold text-stone-400">ทรัพยากรที่เหลือ</div>
        {t.slots.max > 0 && <div><Term name="Spell Slots" /> <b>{t.slots.left}/{t.slots.max}</b></div>}
        <div><Term name="Hit Dice" /> <b>{t.hitDice.left}/{t.hitDice.max}</b></div>
      </div>
    </section>
  )
}

function CareBox({ care }: { care: { id: string; name: string; hp: { current: number; max: number }; kind: CareKind; deathSaves?: { successes: number; failures: number } }[] }) {
  if (care.length === 0) {
    return (
      <div className="col-span-2 rounded-xl border border-emerald-900 bg-emerald-950/40 p-3 text-sm lg:col-span-1">
        <div className="text-xs font-bold text-emerald-300">ต้องดูแลก่อน</div>
        <p className="text-emerald-200">ไม่มีใครบาดเจ็บหนัก</p>
      </div>
    )
  }
  return (
    <div className="col-span-2 rounded-xl border border-red-900 bg-red-950/40 p-3 text-sm lg:col-span-1">
      <div className="text-xs font-bold text-red-300">ต้องดูแลก่อน</div>
      <ul className="space-y-0.5">
        {care.map((x) => (
          <li key={x.id}>
            <b className={x.kind === 'bloodied' ? 'text-orange-300' : 'text-red-300'}>{x.name}</b> · {x.hp.current}/{x.hp.max} HP · {CARE_TEXT[x.kind]}
            {x.kind === 'dying' && x.deathSaves && <span className="text-stone-400"> (Death Save ✓{x.deathSaves.successes} ✗{x.deathSaves.failures})</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Health label with its colour; `dead` / `dying` / `stable` come from the Death Saves. */
function StatusPill({ hp, dead, dying, stable }: { hp: { current: number; max: number }; dead: boolean; dying: boolean; stable: boolean }) {
  const status = healthStatus(hp)
  const [style, body] = dead ? ['bg-red-950 text-red-200', '💀 ตาย']
    : stable ? ['bg-stone-700 text-stone-200', <Term key="s" name="Stable">Stable</Term>]
    : dying ? ['bg-red-900 font-bold text-red-100', <Term key="d" name="Death Save">กำลังจะตาย</Term>]
    : status === 'bloodied' ? ['bg-orange-950 text-orange-300', <Term key="b" name="Bloodied">Bloodied</Term>]
    : status === 'hurt' ? ['bg-amber-950 text-amber-300', HEALTH_LABEL.hurt]
    : ['bg-emerald-950 text-emerald-300', HEALTH_LABEL.healthy]
  return <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs ${style}`}>{body}</span>
}

function DeathSaveDots({ successes, failures }: { successes: number; failures: number }) {
  const dots = (n: number, on: string, off: string) => [0, 1, 2].map((i) => <span key={i} className={`inline-block h-3 w-3 rounded-full border-2 ${i < n ? on : off}`} />)
  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-300">
      <Term name="Death Save" />
      <span className="flex items-center gap-1">สำเร็จ {dots(successes, 'border-emerald-400 bg-emerald-400', 'border-emerald-400')}</span>
      <span className="flex items-center gap-1">ล้มเหลว {dots(failures, 'border-red-400 bg-red-400', 'border-red-400')}</span>
    </div>
  )
}

function Mini({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-stone-900 px-1 py-1 text-center">
      <b className="block">{value}</b>
      <span className="text-[11px] text-stone-400">{label}</span>
    </div>
  )
}

function PartyCard({ r, onGive }: { r: Row; onGive?: () => void }) {
  const c = r.c
  const dead = isDead(c)
  const dying = isDying(c)
  const stable = c.hp.current === 0 && c.deathSaves.successes >= 3
  const slots = c.spellSlots.map((x, i) => ({ ...x, level: i })).filter((x) => x.max > 0)

  return (
    <div className={`flex flex-col gap-2.5 rounded-xl border-2 bg-stone-800 p-3 ${dead ? 'border-red-900 opacity-70' : dying ? 'border-red-500' : 'border-transparent'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <a href={`#/c/${c.id}`} className="text-lg font-bold hover:text-amber-300">
            {r.name} {c.heroicInspiration && <Term name="Heroic Inspiration"><span className="text-amber-400">★</span></Term>}
          </a>
          <div className="text-xs text-stone-400">
            {classLabel(c)}
            {c.species && <> · <Term name={c.species} /></>}
            {c.player && ` · ${c.player}`}
          </div>
        </div>
        <div className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-b-2xl rounded-t-lg border border-stone-600 bg-stone-900">
          <b className="leading-none">{r.ac}</b><span className="text-[10px] text-stone-400"><Term name="AC" /></span>
        </div>
      </div>

      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span><b className="text-2xl">{c.hp.current}</b><span className="text-stone-400"> / {c.hp.max} HP</span>{c.hp.temp > 0 && <span className="text-sm text-sky-300"> +<Term name="Temp HP">{c.hp.temp}</Term></span>}</span>
          <StatusPill hp={c.hp} dead={dead} dying={dying} stable={stable} />
        </div>
        <HpBar current={c.hp.current} max={c.hp.max} className="mt-1 h-2" />
        {c.hp.current === 0 && !dead && <div className="mt-1.5"><DeathSaveDots successes={c.deathSaves.successes} failures={c.deathSaves.failures} /></div>}
      </div>

      {(c.conditions.length > 0 || c.exhaustion > 0 || c.concentration) && (
        <div className="flex flex-wrap gap-1 text-xs">
          {c.conditions.map((x) => (
            <span key={x} className="rounded-full bg-red-900 px-2 py-0.5"><Term name={x}>{x} {CONDITION_TH[x]}</Term></span>
          ))}
          {c.exhaustion > 0 && (
            <span className="rounded-full bg-red-950 px-2 py-0.5 text-red-300"><Term name="Exhaustion">Exhaustion {c.exhaustion}</Term> (D20 −{r.d20Penalty})</span>
          )}
          {c.concentration && <span className="rounded-full bg-violet-900 px-2 py-0.5">🔮 <Term name="Concentration">{c.concentration}</Term></span>}
        </div>
      )}
      {c.buffs.length > 0 && <BuffChips buffs={c.buffs} />}

      <div className="grid grid-cols-4 gap-1.5 text-sm">
        <Mini label={<Term name="Initiative">Init</Term>} value={formatModifier(r.initiative)} />
        <Mini label={<Term name="Speed" />} value={<>{r.speed}{r.heavy && <span title="หนักเกิน"> 🎒</span>}</>} />
        <Mini label={<Term name="Passive Perception">Passive</Term>} value={r.passivePerception} />
        <Mini label={<Term name="Spell Save DC">Spell DC</Term>} value={r.spellSaveDC ?? '–'} />
      </div>

      <div className="space-y-1 text-xs text-stone-300">
        {slots.map((x) => (
          <div key={x.level} className="flex items-center gap-1">
            <Term name="Spell Slots">Slots</Term> {SLOT_LABEL[x.level]}
            {Array.from({ length: x.max }, (_, i) => <span key={i} className={`inline-block h-3 w-3 rounded-full border-2 border-violet-400 ${i < x.max - x.used ? 'bg-violet-500' : ''}`} />)}
          </div>
        ))}
        {c.features.length > 0 && <div>{c.features.map((f) => `${f.name} ${f.max - f.used}/${f.max}`).join(' · ')}</div>}
        <div><Term name="Hit Dice" /> d{hitDieSize(c)} {c.level - c.hitDiceSpent}/{c.level}</div>
      </div>

      <ActionEconomyBar economy={c.turn} compact />

      <div className="mt-auto flex gap-2 pt-1">
        <a href={`#/c/${c.id}`} className="flex min-h-10 flex-1 items-center justify-center rounded-lg bg-stone-700 text-sm font-bold hover:bg-stone-600">เปิดชีท</a>
        {onGive && (
          <button type="button" onClick={onGive} className="min-h-10 flex-1 rounded-lg border border-stone-600 text-sm font-bold text-amber-300 hover:bg-stone-700">🤝 ส่งของให้</button>
        )}
      </div>
    </div>
  )
}

/** Laptop: everyone on one screen. The lowest Passive Perception is marked (easiest to sneak past). */
function PartyTable({ rows }: { rows: Row[] }) {
  const lowestPP = Math.min(...rows.map((r) => r.passivePerception))
  return (
    <div className="overflow-x-auto rounded-xl border border-stone-700 bg-stone-800">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-stone-700 text-left text-xs text-stone-400">
            <th className="px-3 py-2">ตัวละคร</th>
            <th className="w-48 px-3 py-2">HP</th>
            <th className="px-3 py-2">สถานะ</th>
            <th className="px-3 py-2 text-center"><Term name="AC" /></th>
            <th className="px-3 py-2 text-center"><Term name="Initiative">Init</Term></th>
            <th className="px-3 py-2 text-center"><Term name="Speed" /></th>
            <th className="px-3 py-2 text-center"><Term name="Passive Perception">Passive Perc.</Term></th>
            <th className="px-3 py-2 text-center"><Term name="Spell Save DC">Spell DC</Term></th>
            <th className="px-3 py-2"><Term name="Spell Slots" /></th>
            <th className="px-3 py-2"><Term name="Hit Dice" /></th>
            <th className="px-3 py-2">Condition</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const c = r.c
            const dying = isDying(c)
            return (
              <tr key={r.id} className={`border-b border-stone-700/60 last:border-0 ${dying ? 'bg-red-950/30' : ''}`}>
                <td className="px-3 py-2"><a href={`#/c/${c.id}`} className="font-bold hover:text-amber-300">{r.name}</a><div className="text-xs text-stone-400">{classLabel(c)}</div></td>
                <td className="px-3 py-2"><b>{c.hp.current}</b><span className="text-stone-400"> / {c.hp.max}</span>{c.hp.temp > 0 && <span className="text-sky-300"> +{c.hp.temp}</span>}<HpBar current={c.hp.current} max={c.hp.max} className="mt-1 h-1.5" /></td>
                <td className="px-3 py-2">
                  <StatusPill hp={c.hp} dead={isDead(c)} dying={dying} stable={c.hp.current === 0 && c.deathSaves.successes >= 3} />
                  {dying && <div className="mt-0.5 text-xs text-stone-400">✓{c.deathSaves.successes} ✗{c.deathSaves.failures}</div>}
                </td>
                <td className="px-3 py-2 text-center font-bold">{r.ac}</td>
                <td className="px-3 py-2 text-center">{formatModifier(r.initiative)}</td>
                <td className="px-3 py-2 text-center">{r.speed}</td>
                <td className={`px-3 py-2 text-center ${rows.length > 1 && r.passivePerception === lowestPP ? 'font-bold text-amber-300' : ''}`}>{r.passivePerception}</td>
                <td className="px-3 py-2 text-center">{r.spellSaveDC ?? '–'}</td>
                <td className="px-3 py-2">{r.slots ? `${r.slots.left}/${r.slots.max}` : '–'}</td>
                <td className="px-3 py-2">d{hitDieSize(c)} {r.hitDice?.left}/{r.hitDice?.max}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {c.conditions.map((x) => <span key={x} className="rounded-full bg-red-900 px-2 py-0.5 text-xs"><Term name={x} /></span>)}
                    {c.conditions.length === 0 && <span className="text-stone-500">–</span>}
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length > 1 && <p className="px-3 py-2 text-xs text-stone-400">ตัวเลขสีเหลือง = Passive Perception ต่ำสุดในปาร์ตี้ (ศัตรูแอบผ่านคนนี้ได้ง่ายที่สุด)</p>}
    </div>
  )
}

/** Players in a room: the party as the DM's device sends it. Only my own card opens a sheet; friends get a gift button. */
function RoomParty({ cards, myCharacterIds, sort, onSort }: { cards: RoomCard[]; myCharacterIds: string[]; sort: PartySort; onSort: (s: PartySort) => void }) {
  const [giveTo, setGiveTo] = useState<RoomCard | null>(null)
  // My own characters are saved on this phone: they are the ones that can give.
  const mine = useLiveQuery(async () => (await Promise.all(myCharacterIds.map((id) => getCharacter(id)))).filter((c): c is Character => !!c), [myCharacterIds.join(',')])
  const members = cards.map((c) => ({ ...c, id: c.characterId }))
  // The cards carry no Initiative bonus: that sort falls back to the name.
  const sorted = sortParty(members, sort)
  const care = needsCare(members)
  return (
    <div className="space-y-4">
      <a href="#/" className="text-sm text-stone-400">← ตัวละครทั้งหมด</a>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">👥 ภาพรวมปาร์ตี้</h1>
          <p className="text-sm text-stone-400">ตัวละครทุกคนในห้อง · อัปเดตจากเครื่อง DM</p>
        </div>
        <Segmented label="เรียงตาม" value={sort} options={PARTY_SORTS.filter((x) => x.value !== 'initiative')} onChange={onSort} />
      </header>
      {cards.length === 0 && <p className="rounded-xl bg-stone-800 p-6 text-center text-stone-400">ยังไม่มีข้อมูลปาร์ตี้จาก DM (รอเชื่อมต่อ หรือยังไม่มีใครเลือกตัวละคร)</p>}
      {cards.length > 0 && care.length > 0 && <CareBox care={care.map(({ member, kind }) => ({ id: member.id, name: member.name, hp: member.hp, kind }))} />}
      <div className="grid gap-3 md:grid-cols-2">
        {sorted.map((c) => {
          const isMine = myCharacterIds.includes(c.characterId)
          const givers = (mine ?? []).filter((x) => x.id !== c.characterId)
          return <RoomPartyCard key={c.characterId} c={c} mine={isMine} onGive={!isMine && givers.length > 0 ? () => setGiveTo(c) : undefined} />
        })}
      </div>
      {giveTo && (
        <GiveSheet toId={giveTo.characterId} toName={giveTo.name || 'เพื่อน'} givers={(mine ?? []).filter((x) => x.id !== giveTo.characterId)} onClose={() => setGiveTo(null)} />
      )}
    </div>
  )
}

function RoomPartyCard({ c, mine, onGive }: { c: RoomCard; mine: boolean; onGive?: () => void }) {
  const down = c.hp.current <= 0
  return (
    <div className={`space-y-2.5 rounded-xl border-2 bg-stone-800 p-3 ${mine ? 'border-amber-600' : down ? 'border-red-500' : 'border-transparent'}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-bold">{c.name}{mine && <span className="ml-2 rounded-full bg-amber-950 px-2 py-0.5 text-xs text-amber-300">ตัวละครของฉัน</span>}</div>
          <div className="text-xs text-stone-400">{c.className}</div>
        </div>
        <div className="flex h-12 w-11 shrink-0 flex-col items-center justify-center rounded-b-2xl rounded-t-lg border border-stone-600 bg-stone-900">
          <b className="leading-none">{c.ac}</b><span className="text-[10px] text-stone-400"><Term name="AC" /></span>
        </div>
      </div>
      <div>
        <div className="flex items-baseline justify-between gap-2">
          <span><b className="text-2xl">{c.hp.current}</b><span className="text-stone-400"> / {c.hp.max} HP</span>{c.hp.temp > 0 && <span className="text-sm text-sky-300"> +<Term name="Temp HP">{c.hp.temp}</Term></span>}</span>
          <StatusPill hp={c.hp} dead={false} dying={down} stable={false} />
        </div>
        <HpBar current={c.hp.current} max={c.hp.max} className="mt-1 h-2" />
      </div>
      {c.conditions.length > 0 && (
        <div className="flex flex-wrap gap-1 text-xs">
          {c.conditions.map((x) => <span key={x} className="rounded-full bg-red-900 px-2 py-0.5"><Term name={x}>{x} {CONDITION_TH[x]}</Term></span>)}
        </div>
      )}
      <ActionEconomyBar economy={c.turn} compact />
      {mine && <a href={`#/c/${c.characterId}`} className="flex min-h-11 items-center justify-center rounded-lg bg-stone-700 text-sm font-bold">เปิดใบตัวละคร</a>}
      {onGive && (
        <button type="button" onClick={onGive} className="min-h-11 w-full rounded-lg border border-stone-600 bg-stone-900 text-sm font-bold text-amber-300">🤝 ส่งของให้ {c.name}</button>
      )}
    </div>
  )
}
