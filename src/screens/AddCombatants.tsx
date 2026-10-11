// Add PCs (linked to saved sheets) and monsters (quick stats) to a fight.
import { useState } from 'react'
import type { Character } from '../model/character'
import { combatantFromCharacter, createMonsters, type Combatant, type Encounter } from '../model/encounter'
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

  const addPcs = () => onAdd(available.filter((c) => picked.includes(c.id)).map(combatantFromCharacter))
  const addMonsters = () => {
    if (!monster.name.trim()) return
    onAdd(createMonsters(monster, monster.count, encounter.combatants))
    setMonster({ ...monster, name: '' })
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
        <div className="grid grid-cols-2 gap-2">
          <Label text="ชื่อ" className="col-span-2"><TextInput value={monster.name} placeholder="Goblin" onChange={(v) => setMonster({ ...monster, name: v })} /></Label>
          <Label text="AC"><NumberInput value={monster.ac} min={1} max={40} onChange={(v) => setMonster({ ...monster, ac: v })} /></Label>
          <Label text="HP"><NumberInput value={monster.hpMax} min={1} max={9999} onChange={(v) => setMonster({ ...monster, hpMax: v })} /></Label>
          <Label text="โบนัส Initiative"><NumberInput value={monster.initBonus} min={-10} max={20} onChange={(v) => setMonster({ ...monster, initBonus: v })} /></Label>
          <Label text="จำนวน"><NumberInput value={monster.count} min={1} max={20} onChange={(v) => setMonster({ ...monster, count: v })} /></Label>
        </div>
        <Button variant="primary" className={`mt-2 w-full ${monster.name.trim() ? '' : 'opacity-50'}`} onClick={addMonsters}>
          เพิ่ม {monster.count > 1 ? `${monster.count} ตัว` : ''}
        </Button>
      </Section>
    </div>
  )
}
