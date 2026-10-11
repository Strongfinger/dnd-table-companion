// Add PCs (linked to saved sheets) and monsters (quick stats) to a fight.
import { useEffect, useState } from 'react'
import type { Character } from '../model/character'
import { combatantFromCharacter, createMonsters, type Combatant, type Encounter } from '../model/encounter'
import { formatCR, loadSrdMonsters, monsterInput, rollMonsterHp, searchMonsters, type SrdMonster } from '../model/monsters'
import { Button, Label, NumberInput, Section, TextInput } from '../ui/kit'

export default function AddCombatants({ encounter, characters, onAdd }: {
  encounter: Encounter
  characters: Character[]
  onAdd: (list: Combatant[]) => void
}) {
  const linked = new Set(encounter.combatants.map((c) => c.characterId))
  const available = characters.filter((c) => !linked.has(c.id))
  const [picked, setPicked] = useState<string[]>([])
  const [monster, setMonster] = useState({ name: '', ac: 12, hpMax: 10, initBonus: 0, count: 1 })
  // The SRD stat block the form was filled from (for rolling HP), if any.
  const [srdPick, setSrdPick] = useState<SrdMonster | null>(null)
  const [rollHp, setRollHp] = useState(false)

  const addPcs = () => onAdd(available.filter((c) => picked.includes(c.id)).map(combatantFromCharacter))
  const addMonsters = () => {
    if (!monster.name.trim()) return
    let list = createMonsters(monster, monster.count, encounter.combatants)
    // Rolled HP: every copy rolls its own hit dice.
    if (rollHp && srdPick) list = list.map((m) => {
      const hp = rollMonsterHp(srdPick)
      return { ...m, hp: { max: hp, current: hp, temp: 0 } }
    })
    onAdd(list)
    setMonster({ ...monster, name: '' })
    setSrdPick(null)
  }

  function pick(m: SrdMonster) {
    const input = monsterInput(m)
    setMonster({ ...monster, name: input.name, ac: input.ac, hpMax: input.hpMax, initBonus: input.initBonus })
    setSrdPick(m)
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Section title="🧑 ผู้เล่น (ตัวละครในเครื่องนี้)">
        {available.length === 0 && <p className="text-sm text-stone-500">ไม่มีตัวละครที่ยังไม่ได้เพิ่ม (นำเข้าไฟล์จากผู้เล่นได้ที่แท็บ ตัวละคร)</p>}
        <div className="space-y-1">
          {available.map((c) => (
            <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-stone-900 p-2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-amber-400"
                checked={picked.includes(c.id)}
                onChange={(e) => setPicked(e.target.checked ? [...picked, c.id] : picked.filter((x) => x !== c.id))}
              />
              <span className="flex-1">{c.name}</span>
              <span className="text-xs text-stone-400">{c.className} {c.level} · HP {c.hp.current}/{c.hp.max}</span>
            </label>
          ))}
        </div>
        {available.length > 0 && (
          <Button variant="primary" className={`mt-2 w-full ${picked.length ? '' : 'opacity-50'}`} onClick={addPcs}>
            เพิ่มผู้เล่น ({picked.length})
          </Button>
        )}
        <p className="mt-2 text-xs text-stone-500">HP ของผู้เล่นเชื่อมกับใบตัวละคร: ดาเมจในการต่อสู้จะอัปเดตใบตัวละครในเครื่องนี้</p>
      </Section>

      <Section title="👹 มอนสเตอร์ / NPC">
        <SrdPicker onPick={pick} />
        {srdPick && (
          <p className="mt-2 rounded-lg bg-stone-900 p-2 text-xs text-stone-300">
            {srdPick.name}: {srdPick.size} {srdPick.type} · CR {formatCR(srdPick.cr)} ({srdPick.xp} XP) · Speed {srdPick.speed}
            {' '}· Initiative ใช้ DEX ({monster.initBonus >= 0 ? '+' : ''}{monster.initBonus}): หลาย Stat Block บวก Proficiency Bonus เพิ่ม ตรวจแล้วแก้ช่อง "โบนัส Initiative" ได้
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Label text="ชื่อ" className="col-span-2"><TextInput value={monster.name} placeholder="Goblin" onChange={(v) => setMonster({ ...monster, name: v })} /></Label>
          <Label text="AC"><NumberInput value={monster.ac} min={1} max={40} onChange={(v) => setMonster({ ...monster, ac: v })} /></Label>
          <Label text="HP"><NumberInput value={monster.hpMax} min={1} max={9999} onChange={(v) => setMonster({ ...monster, hpMax: v })} /></Label>
          <Label text="โบนัส Initiative"><NumberInput value={monster.initBonus} min={-10} max={20} onChange={(v) => setMonster({ ...monster, initBonus: v })} /></Label>
          <Label text="จำนวน"><NumberInput value={monster.count} min={1} max={20} onChange={(v) => setMonster({ ...monster, count: v })} /></Label>
        </div>
        {srdPick && (
          <div className="mt-2 flex gap-2 text-sm">
            <button type="button" onClick={() => setRollHp(false)} className={`flex-1 rounded-lg border px-2 py-1 ${!rollHp ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>
              HP เฉลี่ย ({srdPick.hp})
            </button>
            <button type="button" onClick={() => setRollHp(true)} className={`flex-1 rounded-lg border px-2 py-1 ${rollHp ? 'border-amber-400 bg-amber-500 font-bold text-stone-900' : 'border-stone-600'}`}>
              🎲 ทอย HP ({srdPick.hpRoll})
            </button>
          </div>
        )}
        <Button variant="primary" className={`mt-2 w-full ${monster.name.trim() ? '' : 'opacity-50'}`} onClick={addMonsters}>
          เพิ่ม {monster.count > 1 ? `${monster.count} ตัว` : ''}
        </Button>
      </Section>
    </div>
  )
}

const CR_LIMITS = [
  { value: 30, label: 'ทุก CR' }, { value: 0.25, label: 'CR ≤ 1/4' }, { value: 1, label: 'CR ≤ 1' },
  { value: 3, label: 'CR ≤ 3' }, { value: 5, label: 'CR ≤ 5' }, { value: 10, label: 'CR ≤ 10' },
]

/** Search the SRD 5.2.1 monsters (loaded on first open) and pick one to fill the form. */
function SrdPicker({ onPick }: { onPick: (m: SrdMonster) => void }) {
  const [all, setAll] = useState<SrdMonster[] | null>(null)
  const [query, setQuery] = useState('')
  const [crMax, setCrMax] = useState(30)

  useEffect(() => {
    loadSrdMonsters().then(setAll)
  }, [])

  const results = all ? searchMonsters(all, query, crMax).slice(0, 30) : []

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="flex-1"><TextInput value={query} placeholder="ค้นหามอนสเตอร์ SRD เช่น goblin, dragon" onChange={setQuery} /></div>
        <select className="rounded-lg border border-stone-600 bg-stone-900 px-2 text-base" value={crMax} onChange={(e) => setCrMax(Number(e.target.value))} aria-label="จำกัด CR">
          {CR_LIMITS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>
      {!all && <p className="text-sm text-stone-500">กำลังโหลดรายชื่อมอนสเตอร์…</p>}
      {all && query.trim() !== '' && (
        <ul className="max-h-56 space-y-1 overflow-y-auto">
          {results.length === 0 && <li className="text-sm text-stone-500">ไม่พบ</li>}
          {results.map((m) => (
            <li key={m.id}>
              <button type="button" onClick={() => onPick(m)} className="flex w-full items-center justify-between rounded-lg bg-stone-900 px-3 py-2 text-left hover:bg-stone-700">
                <span>
                  <span className="font-bold">{m.name}</span>
                  <span className="ml-2 text-xs text-stone-400">{m.type}</span>
                </span>
                <span className="text-xs text-stone-300">CR {formatCR(m.cr)} · AC {m.ac} · HP {m.hp}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
