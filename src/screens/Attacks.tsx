// The sheet's attacks: equipped SRD weapons (from the inventory) and hand-made attacks from the edit
// page. 🎯 rolls the attack (d20 + bonus); 💥 rolls damage as a separate tap, after the DM says it hit
// (turn on Critical in the roller for a Critical Hit). Both open the floating dice roller, so real
// dice, Advantage and sharing with the room work the same as everywhere else.
import { useState } from 'react'
import { formatModifier, type DerivedAttack } from '../rules'
import type { Character } from '../model/character'
import { weaponPropertiesLine } from '../model/equipment'
import { equippedWeapons, type EquippedWeapon } from '../model/inventory'
import { ABILITY_LABEL } from '../ui/labels'
import { openRoller } from '../ui/rollerBus'
import { Section } from '../ui/kit'
import { useEquipment } from './useSrdData'

const attackExpr = (hit: number) => (hit === 0 ? '1d20' : `1d20${formatModifier(hit)}`)

export default function Attacks({ c, manual }: { c: Character; manual: DerivedAttack[] }) {
  const data = useEquipment()
  const weapons = data ? equippedWeapons(c, data) : []
  if (weapons.length === 0 && manual.length === 0) return null

  return (
    <Section title="อาวุธและการโจมตี (Attacks)">
      <p className="mb-2 text-xs text-stone-400">🎯 ทอยโจมตี · ถ้า DM บอกว่าโดน กด 💥 ทอยดาเมจ (Critical: เปิดในหน้าทอย) · ⭐ = เลือกเป็น Weapon Mastery ได้ · แตะชื่ออาวุธเพื่อดูรายละเอียด</p>
      <ul className="divide-y divide-stone-700">
        {weapons.map((w) => <WeaponRow key={w.itemId} w={w} />)}
        {manual.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-[10rem] flex-1 font-bold">{a.name || '(ไม่มีชื่อ)'}</span>
            <RollButtons name={a.name} hit={a.hit} damage={[{ label: '', dice: a.damage }]} damageType={a.damageType} />
          </li>
        ))}
      </ul>
      {!data && <p className="text-xs text-stone-500">กำลังโหลดข้อมูลอาวุธ…</p>}
    </Section>
  )
}

function WeaponRow({ w }: { w: EquippedWeapon }) {
  const [open, setOpen] = useState(false)
  const { attack, weapon } = w
  const damage = [
    { label: '', dice: attack.damage },
    ...(attack.twoHanded ? [{ label: '2 มือ', dice: attack.twoHanded }] : []),
    ...(attack.offHand ? [{ label: 'มือรอง', dice: attack.offHand }] : []),
  ]
  const feet = (r: { normal: number; long?: number }) => `${r.normal}${r.long ? `/${r.long}` : ''} ft.`
  const range = weapon.type === 'Ranged'
    ? `ระยะ ${feet(weapon.range)}`
    : `${weapon.properties.includes('Reach') ? 'Reach 10 ft.' : 'ประชิด 5 ft.'}${weapon.thrown ? ` · ขว้าง ${feet(weapon.thrown)}` : ''}`
  return (
    <li className="py-2">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="min-w-[10rem] flex-1 text-left" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="font-bold">{w.name}</span>
          {!w.trained && <span className="ml-1 rounded bg-amber-900 px-1 text-xs text-amber-200">ไม่ชำนาญ</span>}
          <span className="block text-xs text-stone-400">
            {ABILITY_LABEL[attack.ability].short} · {range} · {w.mastery.name}{w.mastery.usable ? ' ⭐' : ''}
          </span>
        </button>
        <RollButtons name={w.name} hit={attack.hit} damage={damage} damageType={weapon.damageType} />
      </div>
      {open && (
        <div className="mt-2 space-y-1 rounded-lg bg-stone-900 p-2 text-sm">
          <p className="text-stone-300">
            {weapon.category} {weapon.type} Weapon · {weapon.dice} {weapon.damageType}
            {weapon.properties.length > 0 && ` · ${weaponPropertiesLine(weapon)}`}
          </p>
          {!w.trained && <p className="text-amber-300">Class นี้ไม่ได้ฝึกใช้อาวุธนี้: ไม่บวก Proficiency Bonus ในการโจมตี</p>}
          {attack.offHand && (
            <p className="text-stone-400">
              Light: ใช้ Attack action โจมตีด้วยอาวุธ Light แล้ว โจมตีเพิ่มได้ 1 ครั้งเป็น Bonus Action ด้วยอาวุธ Light อีกชิ้น (ดาเมจ "มือรอง" ไม่บวกค่า Ability ที่เป็นบวก)
              {w.mastery.name === 'Nick' && w.mastery.usable && ' · ถ้าใช้ Nick ได้: การโจมตีเพิ่มนี้เป็นส่วนหนึ่งของ Attack action แทน Bonus Action (เทิร์นละครั้ง)'}
            </p>
          )}
          <p>
            <span className="font-bold">Mastery: {w.mastery.name}</span>
            {w.mastery.usable
              ? ' ⭐ ใช้ได้ถ้าเป็นอาวุธที่เลือกไว้กับ Weapon Mastery (เปลี่ยนได้ 1 อย่างหลัง Long Rest)'
              : ' (ใช้ได้เฉพาะ Class ที่มี Weapon Mastery กับอาวุธที่เลือกไว้)'}
          </p>
          <p className="text-stone-300">{w.mastery.text}</p>
        </div>
      )}
    </li>
  )
}

/** 🎯 attack and 💥 damage buttons (one per damage option: one-handed, two-handed, off-hand). */
function RollButtons({ name, hit, damage, damageType }: { name: string; hit: number; damage: { label: string; dice: string }[]; damageType: string }) {
  const title = name || 'โจมตี'
  return (
    <div className="ml-auto flex flex-wrap justify-end gap-1.5">
      <button
        type="button"
        className="rounded-lg bg-amber-600 px-3 py-1.5 font-bold text-stone-950"
        aria-label={`ทอยโจมตี ${title} ${formatModifier(hit)}`}
        onClick={() => openRoller({ expression: attackExpr(hit), label: `${title} · โจมตี` })}
      >
        🎯 {formatModifier(hit)}
      </button>
      {damage.map((d) => (
        <button
          key={d.label}
          type="button"
          className="rounded-lg bg-stone-700 px-3 py-1.5"
          aria-label={`ทอยดาเมจ ${title} ${d.label} ${d.dice}`}
          onClick={() => openRoller({ expression: d.dice, label: `${title} · ดาเมจ${d.label ? ` (${d.label})` : ''} ${damageType}`.trim() })}
        >
          💥 {d.label && <span className="text-xs text-stone-300">{d.label} </span>}{d.dice}
        </button>
      ))}
    </div>
  )
}
