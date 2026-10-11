import { useEffect, useState } from 'react'
import { go } from '../app/router'
import { deleteCharacter, getCharacter, saveCharacter } from '../db/characters'
import { createCharacter, newId, type Character } from '../model/character'
import {
  ABILITIES, CLASS_SAVES, CLASS_SPELLCASTING, CLASSES, deriveSheet, formatModifier,
  SKILL_ABILITY, SKILLS, type Ability, type ClassName, type ProficiencyLevel,
} from '../rules'
import { Button, Checkbox, Label, NumberInput, Section, Select, TextArea, TextInput } from '../ui/kit'
import { ABILITY_LABEL } from '../ui/labels'

const CLASS_OPTIONS = CLASSES.map((c) => ({ value: c, label: c }))
const ABILITY_OPTIONS = ABILITIES.map((a) => ({ value: a, label: ABILITY_LABEL[a].short }))
const CASTING_OPTIONS = [{ value: 'none', label: '— ไม่มี —' }, ...ABILITY_OPTIONS] as const
const NEXT_LEVEL: Record<ProficiencyLevel, ProficiencyLevel> = { none: 'proficient', proficient: 'expertise', expertise: 'none' }

/** id = undefined means "create a new character". */
export default function CharacterEdit({ id }: { id?: string }) {
  const isNew = id === undefined
  // The draft is a copy we edit freely; nothing is saved until "บันทึก" is pressed.
  const [draft, setDraft] = useState<Character | null>(() => (isNew ? createCharacter() : null))
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (id) getCharacter(id).then((c) => (c ? setDraft(c) : setNotFound(true)))
  }, [id])

  if (notFound) return <p className="text-center text-stone-400">ไม่พบตัวละครนี้ในเครื่อง</p>
  if (!draft) return null

  const c = draft
  const s = deriveSheet(c)
  const set = <K extends keyof Character>(key: K, value: Character[K]) => setDraft({ ...c, [key]: value })

  function changeClass(className: ClassName) {
    setDraft({
      ...c,
      className,
      saveProficiencies: [...CLASS_SAVES[className]],
      spellcastingAbility: CLASS_SPELLCASTING[className],
    })
  }

  function toggleSave(a: Ability, on: boolean) {
    set('saveProficiencies', on ? [...c.saveProficiencies, a] : c.saveProficiencies.filter((x) => x !== a))
  }

  async function save() {
    if (!c.name.trim()) {
      alert('กรุณาใส่ชื่อตัวละคร')
      return
    }
    // A new character starts at full HP; otherwise current HP can't be above the max.
    const current = isNew ? c.hp.max : Math.min(c.hp.current, c.hp.max)
    const saved = await saveCharacter({ ...c, name: c.name.trim(), hp: { ...c.hp, current } })
    go(`/c/${saved.id}`)
  }

  async function remove() {
    if (!confirm(`ลบ ${c.name || 'ตัวละครนี้'} ออกจากเครื่อง? ย้อนกลับไม่ได้`)) return
    await deleteCharacter(c.id)
    go('/')
  }

  const cancel = () => go(isNew ? '/' : `/c/${c.id}`)

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-2xl font-bold text-amber-400">{isNew ? 'สร้างตัวละครใหม่' : `แก้ไข ${c.name}`}</h1>

      <Section title="ข้อมูลทั่วไป">
        <div className="grid grid-cols-2 gap-3">
          <Label text="ชื่อตัวละคร *" className="col-span-2"><TextInput value={c.name} onChange={(v) => set('name', v)} /></Label>
          <Label text="Class"><Select value={c.className} options={CLASS_OPTIONS} onChange={changeClass} /></Label>
          <Label text="Level"><NumberInput value={c.level} min={1} max={20} onChange={(v) => set('level', v)} /></Label>
          <Label text="Subclass"><TextInput value={c.subclass} onChange={(v) => set('subclass', v)} /></Label>
          <Label text="Species (เผ่าพันธุ์)"><TextInput value={c.species} onChange={(v) => set('species', v)} /></Label>
          <Label text="Background (ภูมิหลัง)"><TextInput value={c.background} onChange={(v) => set('background', v)} /></Label>
          <Label text="Alignment"><TextInput value={c.alignment} onChange={(v) => set('alignment', v)} /></Label>
          <Label text="ผู้เล่น" className="col-span-2"><TextInput value={c.player} onChange={(v) => set('player', v)} /></Label>
        </div>
        <p className="mt-2 text-xs text-stone-500">เปลี่ยน Class แล้ว Saving Throw และ Spellcasting จะถูกตั้งให้ตาม Class (แก้เองได้)</p>
      </Section>

      <Section title="Ability Scores · Saving Throws">
        <div className="grid grid-cols-3 gap-3">
          {ABILITIES.map((a) => (
            <div key={a} className="text-center">
              <div className="text-sm font-bold">{ABILITY_LABEL[a].short}</div>
              <div className="mb-1 text-xs text-stone-500">{ABILITY_LABEL[a].th}</div>
              <NumberInput value={c.scores[a]} min={1} max={30} onChange={(v) => set('scores', { ...c.scores, [a]: v })} />
              <div className="mt-1 text-lg font-bold">{formatModifier(s.modifiers[a])}</div>
              <Checkbox
                checked={c.saveProficiencies.includes(a)}
                onChange={(on) => toggleSave(a, on)}
                label={<span className="text-xs">Save {formatModifier(s.saves[a])}</span>}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Skills">
        <p className="mb-2 text-xs text-stone-500">แตะเพื่อสลับ: ไม่ชำนาญ → Proficient ● → Expertise ★</p>
        <ul className="divide-y divide-stone-700">
          {SKILLS.map((skill) => {
            const level = c.skills[skill] ?? 'none'
            return (
              <li key={skill}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-2 text-left"
                  onClick={() => set('skills', { ...c.skills, [skill]: NEXT_LEVEL[level] })}
                >
                  <span className={level === 'none' ? 'text-stone-300' : 'font-bold text-amber-300'}>
                    <span className="inline-block w-5">{level === 'proficient' ? '●' : level === 'expertise' ? '★' : '○'}</span>
                    {skill} <span className="text-xs font-normal text-stone-500">{ABILITY_LABEL[SKILL_ABILITY[skill]].short}</span>
                  </span>
                  <span>{formatModifier(s.skills[skill])}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </Section>

      <Section title="HP · AC · Initiative">
        <div className="grid grid-cols-3 gap-3">
          <Label text="Max HP">
            <NumberInput value={c.hp.max} min={1} max={999} onChange={(v) => set('hp', { ...c.hp, max: v })} />
          </Label>
          <Label text="AC"><NumberInput value={c.ac} min={1} max={40} onChange={(v) => set('ac', v)} /></Label>
          <Label text="Speed (ft.)"><NumberInput value={c.speed} min={0} max={200} onChange={(v) => set('speed', v)} /></Label>
        </div>
        <button type="button" className="mt-2 text-sm text-amber-400 underline" onClick={() => set('hp', { ...c.hp, max: s.suggestedMaxHp })}>
          ใช้ Max HP แบบค่าเฉลี่ย: {s.suggestedMaxHp}
        </button>
        <p className="text-xs text-stone-500">ถ้าทอยเต๋า HP หรือมีโบนัส (เช่น Dwarven Toughness) ให้ใส่เอง</p>

        <div className="mt-3 flex items-end gap-3">
          <div className="flex-1">
            <Checkbox
              checked={c.initiativeProficient}
              onChange={(v) => set('initiativeProficient', v)}
              label="Alert (+Proficiency ใน Initiative)"
            />
          </div>
          <Label text="โบนัสอื่น" className="w-24">
            <NumberInput value={c.initiativeMisc} min={-10} max={20} onChange={(v) => set('initiativeMisc', v)} />
          </Label>
        </div>
        <p className="mt-1 text-sm">Initiative: <b>{formatModifier(s.initiative)}</b></p>
      </Section>

      <Section title="Spellcasting">
        <Label text="Spellcasting Ability">
          <Select
            value={c.spellcastingAbility ?? 'none'}
            options={CASTING_OPTIONS}
            onChange={(v) => set('spellcastingAbility', v === 'none' ? null : v)}
          />
        </Label>
        {s.spellSaveDC !== null && (
          <p className="mt-2 text-sm">Spell Save DC <b>{s.spellSaveDC}</b> · Spell Attack <b>{formatModifier(s.spellAttack ?? 0)}</b></p>
        )}
      </Section>

      <Section
        title="อาวุธและการโจมตี (Attacks)"
        action={
          <Button
            className="text-sm"
            onClick={() => set('attacks', [...c.attacks, {
              id: newId(), name: '', ability: 'str', proficient: true, damageDice: '1d6', damageType: '', addModToDamage: true,
            }])}
          >
            + เพิ่ม
          </Button>
        }
      >
        <div className="space-y-3">
          {c.attacks.map((atk, i) => {
            const update = (patch: Partial<typeof atk>) => set('attacks', c.attacks.map((x, j) => (j === i ? { ...x, ...patch } : x)))
            const derived = s.attacks[i]
            return (
              <div key={atk.id} className="rounded-lg bg-stone-900 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Label text="ชื่อ" className="col-span-2"><TextInput value={atk.name} placeholder="Longsword" onChange={(v) => update({ name: v })} /></Label>
                  <Label text="Ability"><Select value={atk.ability} options={ABILITY_OPTIONS} onChange={(v) => update({ ability: v })} /></Label>
                  <Label text="ลูกเต๋าความเสียหาย"><TextInput value={atk.damageDice} placeholder="1d8" onChange={(v) => update({ damageDice: v.trim() })} /></Label>
                  <Label text="ประเภทความเสียหาย" className="col-span-2"><TextInput value={atk.damageType} placeholder="slashing" onChange={(v) => update({ damageType: v })} /></Label>
                </div>
                <Checkbox checked={atk.proficient} onChange={(v) => update({ proficient: v })} label="Proficient กับอาวุธนี้" />
                <Checkbox checked={!atk.addModToDamage} onChange={(v) => update({ addModToDamage: !v })} label="มือรอง (Off-hand): ไม่บวก modifier ในความเสียหาย" />
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm">ทอยโจมตี <b>{formatModifier(derived.hit)}</b> · ความเสียหาย <b>{derived.damage}</b></span>
                  <button type="button" className="text-sm text-red-400" onClick={() => set('attacks', c.attacks.filter((_, j) => j !== i))}>ลบ</button>
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      <Section
        title="ของในกระเป๋า (Inventory)"
        action={<Button className="text-sm" onClick={() => set('inventory', [...c.inventory, { id: newId(), name: '', qty: 1 }])}>+ เพิ่ม</Button>}
      >
        <div className="mb-3 grid grid-cols-5 gap-2">
          {(['cp', 'sp', 'ep', 'gp', 'pp'] as const).map((coin) => (
            <Label key={coin} text={coin.toUpperCase()}>
              <NumberInput value={c.coins[coin]} min={0} max={999999} onChange={(v) => set('coins', { ...c.coins, [coin]: v })} />
            </Label>
          ))}
        </div>
        <div className="space-y-2">
          {c.inventory.map((item, i) => {
            const update = (patch: Partial<typeof item>) => set('inventory', c.inventory.map((x, j) => (j === i ? { ...x, ...patch } : x)))
            return (
              <div key={item.id} className="flex items-center gap-2">
                <div className="flex-1"><TextInput value={item.name} placeholder="Rope" onChange={(v) => update({ name: v })} /></div>
                <div className="w-20"><NumberInput value={item.qty} min={0} max={9999} onChange={(v) => update({ qty: v })} /></div>
                <button type="button" className="px-2 text-red-400" onClick={() => set('inventory', c.inventory.filter((_, j) => j !== i))}>✕</button>
              </div>
            )
          })}
        </div>
      </Section>

      <Section title="ความสามารถพิเศษ (Features & Traits)">
        <TextArea value={c.featuresText} rows={6} onChange={(v) => set('featuresText', v)} />
      </Section>
      <Section title="ความชำนาญอื่นๆ และภาษา">
        <TextArea value={c.proficienciesText} onChange={(v) => set('proficienciesText', v)} />
      </Section>
      <Section title="โน้ต">
        <TextArea value={c.notes} onChange={(v) => set('notes', v)} />
      </Section>

      {!isNew && <Button variant="danger" className="w-full" onClick={remove}>ลบตัวละคร</Button>}

      {/* Save bar stays at the bottom of the screen on phones. */}
      <div className="fixed inset-x-0 bottom-0 border-t border-stone-700 bg-stone-900/95 p-3">
        <div className="mx-auto flex max-w-xl gap-2">
          <Button className="flex-1" onClick={cancel}>ยกเลิก</Button>
          <Button variant="primary" className="flex-1" onClick={save}>บันทึก</Button>
        </div>
      </div>
    </div>
  )
}
