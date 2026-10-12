import { useEffect, useState } from 'react'
import { go } from '../app/router'
import { useLobby } from '../app/useLobby'
import { useLiveQuery } from 'dexie-react-hooks'
import { listCampaigns } from '../db/campaigns'
import { deleteCharacter, getCharacter, saveCharacter } from '../db/characters'
import { newId, type Character } from '../model/character'
import { mergeDraft } from '../model/sync'
import { applyAutoAC, characterArmorClass } from '../model/inventory'
import { addNewlyAvailable, refreshCatalogFeatures } from '../model/featureCatalog'
import { useEquipment } from './useSrdData'
import {
  ABILITIES, BACKGROUND_INFO, BACKGROUNDS, CLASS_INFO, FEAT_INFO, CLASS_SPELLCASTING, CLASSES, checkCharacter, classSavesAtLevel,
  deriveSheet, formatModifier, isSrdBackground, MAX_FEATURE_USES, isSrdSpecies, maxExpertise, ORIGIN_FEATS, SKILL_ABILITY, skillSources,
  SKILLS, SPECIES, SPECIES_INFO, spellSlotsFor, SUBCLASS_LEVEL, suggestedMaxHp, type Ability, type ClassName, type ProficiencyLevel, type Skill,
} from '../rules'
import { Button, Checkbox, ChoiceField, Label, NumberInput, RuleMessages, Section, Select, TextArea, TextInput } from '../ui/kit'
import { ABILITY_LABEL } from '../ui/labels'

const CLASS_OPTIONS = CLASSES.map((c) => ({ value: c, label: c }))
const ABILITY_OPTIONS = ABILITIES.map((a) => ({ value: a, label: ABILITY_LABEL[a].short }))
const RECHARGE_OPTIONS = [
  { value: 'long', label: 'Long Rest' },
  { value: 'short', label: 'Short Rest (หมด)' },
  { value: 'shortOne', label: 'Short +1 / Long หมด' },
] as const
const CASTING_OPTIONS = [{ value: 'none', label: '— ไม่มี —' }, ...ABILITY_OPTIONS] as const

/** Edit an existing character. New characters are made in CreateWizard. */
export default function CharacterEdit({ id }: { id: string }) {
  // The draft is a copy we edit freely; nothing is saved until "บันทึก" is pressed.
  const [draft, setDraft] = useState<Character | null>(null)
  // The copy the form started from: on save, fields the form didn't change keep their newest value.
  const [original, setOriginal] = useState<Character | null>(null)
  const [notFound, setNotFound] = useState(false)
  // DM override: unlocks fields the rules would normally fix (saves, subclass level, Expertise).
  const [freeEdit, setFreeEdit] = useState(false)
  const equipment = useEquipment()
  const campaigns = useLiveQuery(listCampaigns) ?? []
  const lobby = useLobby()

  useEffect(() => {
    getCharacter(id).then((c) => {
      if (!c) return setNotFound(true)
      setDraft(c)
      setOriginal(c)
      // A creature from a stat block doesn't follow class rules: don't let them overwrite its numbers.
      if (c.monster) setFreeEdit(true)
    })
  }, [id])

  if (notFound) return <p className="text-center text-stone-400">ไม่พบตัวละครนี้ในเครื่อง</p>
  if (!draft) return null

  const c = draft
  const s = deriveSheet(c)
  // Class rules don't apply to a creature from a stat block (its className is only a placeholder).
  const messages = c.monster ? [] : checkCharacter(c)
  const set = <K extends keyof Character>(key: K, value: Character[K]) => setDraft({ ...c, [key]: value })
  const { classChoices, backgroundSkills } = skillSources(c)
  const expertiseLeft = maxExpertise(c.className, c.level) - SKILLS.filter((k) => c.skills[k] === 'expertise').length
  const subclassLocked = c.level < SUBCLASS_LEVEL && !freeEdit

  /** Spell slot maximums from the class table; used slots are kept but never above the new max. */
  function slotsFor(className: ClassName, level: number) {
    return spellSlotsFor(className, level).map((max, i) => ({ max, used: Math.min(c.spellSlots[i]?.used ?? 0, max) }))
  }

  function changeClass(className: ClassName) {
    setDraft({
      ...c,
      className,
      subclass: '',
      saveProficiencies: classSavesAtLevel(className, c.level),
      // Keep an existing ability (e.g. from Magic Initiate) when the new class doesn't cast.
      spellcastingAbility: CLASS_SPELLCASTING[className] ?? c.spellcastingAbility,
      spellSlots: freeEdit ? c.spellSlots : slotsFor(className, c.level),
    })
  }

  function changeLevel(level: number) {
    // Saves can change with level (Monk 14, Rogue 15) unless the DM is editing freely.
    setDraft({
      ...c,
      level,
      saveProficiencies: freeEdit ? c.saveProficiencies : classSavesAtLevel(c.className, level),
      spellSlots: freeEdit ? c.spellSlots : slotsFor(c.className, level),
      hitDiceSpent: Math.min(c.hitDiceSpent, level),
    })
  }

  function changeSpecies(species: string) {
    setDraft({ ...c, species, speed: isSrdSpecies(species) ? SPECIES_INFO[species].speed : c.speed })
  }

  /**
   * Swapping background adds its 2 skills and swaps its Origin feat.
   * Old background skills are kept (they may also come from class or species);
   * the rule check shows if there are too many, and the player taps them off.
   */
  function changeBackground(background: string) {
    const skills = { ...c.skills }
    let feats = [...c.feats]
    if (isSrdBackground(c.background)) {
      const i = feats.indexOf(BACKGROUND_INFO[c.background].feat)
      if (i >= 0) feats.splice(i, 1)
    }
    if (isSrdBackground(background)) {
      const next = BACKGROUND_INFO[background]
      for (const k of next.skills) skills[k] = skills[k] === 'expertise' ? 'expertise' : 'proficient'
      const duplicate = feats.includes(next.feat) && !FEAT_INFO[next.feat].repeatable
      if (!duplicate) feats = [...feats, next.feat]
    }
    const hasAlert = feats.includes('Alert')
    setDraft({ ...c, background, skills, feats, initiativeProficient: hasAlert || (c.initiativeProficient && !c.feats.includes('Alert')) })
  }

  function toggleFeat(feat: string, on: boolean) {
    const feats = on ? [...c.feats, feat] : c.feats.filter((f, i) => f !== feat || i !== c.feats.indexOf(feat))
    setDraft({ ...c, feats, initiativeProficient: feat === 'Alert' ? on : c.initiativeProficient })
  }

  /** Tap cycles ○ → ● → ★ (only if Expertise is allowed) → ○. */
  function cycleSkill(skill: Skill) {
    const level = c.skills[skill] ?? 'none'
    const canExpertise = freeEdit || expertiseLeft > 0
    const next: ProficiencyLevel = level === 'none' ? 'proficient' : level === 'proficient' && canExpertise ? 'expertise' : 'none'
    set('skills', { ...c.skills, [skill]: next })
  }

  function toggleSave(a: Ability, on: boolean) {
    set('saveProficiencies', on ? [...c.saveProficiencies, a] : c.saveProficiencies.filter((x) => x !== a))
  }

  async function save() {
    if (!c.name.trim()) {
      alert('กรุณาใส่ชื่อตัวละคร')
      return
    }
    // The sheet may have changed while the form was open (damage in the tracker, the DM's device in a
    // live lobby): keep those changes in the fields this form didn't touch, and continue its revision.
    const latest = await getCharacter(c.id)
    const merged = latest && original ? mergeDraft(original, c, latest) : c
    // Current HP can't be above the (possibly lowered) max.
    const current = Math.min(merged.hp.current, merged.hp.max)
    // Auto AC and SRD feature uses follow the edits (ability scores, class, level, bonus).
    const refreshed = refreshCatalogFeatures(latest ? addNewlyAvailable(latest, merged) : merged)
    const withAc = equipment ? applyAutoAC(refreshed, equipment) : refreshed
    const saved = await saveCharacter({ ...withAc, name: merged.name.trim(), hp: { ...merged.hp, current }, rev: latest?.rev ?? c.rev })
    lobby.shareSheet(saved.id)
    go(`/c/${saved.id}`)
  }

  async function remove() {
    if (!confirm(`ลบ ${c.name || 'ตัวละครนี้'} ออกจากเครื่อง? ย้อนกลับไม่ได้`)) return
    await deleteCharacter(c.id)
    go('/')
  }

  const cancel = () => go(`/c/${c.id}`)

  return (
    <div className="space-y-4 pb-24">
      <h1 className="text-2xl font-bold text-amber-400">แก้ไข {c.name}</h1>
      {c.monster && (
        <p className="rounded-lg bg-stone-900 p-3 text-sm text-stone-300">
          🐾 ตัวละครนี้มาจาก Stat block ({c.monster.source}): Proficiency Bonus +{c.monster.pb} และ Hit Die d{c.monster.hitDie} มาจาก Stat block
          (ไม่ใช่ Class/Level) · Level = จำนวน Hit Dice · เปิดโหมดแก้ไขอิสระไว้ให้แล้ว
        </p>
      )}

      <Section title="ตรวจกติกา">
        <RuleMessages messages={messages} />
        <div className="mt-2">
          <Checkbox checked={freeEdit} onChange={setFreeEdit} label={<span className="text-sm">โหมดแก้ไขอิสระ (DM) — ปลดล็อกช่องที่กติกากำหนด</span>} />
        </div>
      </Section>

      <Section title="ข้อมูลทั่วไป">
        <div className="grid grid-cols-2 gap-3">
          <Label text="ชื่อตัวละคร *" className="col-span-2"><TextInput value={c.name} onChange={(v) => set('name', v)} /></Label>
          <Label text="Class"><Select value={c.className} options={CLASS_OPTIONS} onChange={changeClass} /></Label>
          <Label text="Level"><NumberInput value={c.level} min={1} max={20} onChange={changeLevel} /></Label>
          <Label text={subclassLocked ? `Subclass (Level ${SUBCLASS_LEVEL}+)` : 'Subclass'} className="col-span-2">
            <ChoiceField key={c.className} value={c.subclass} options={[CLASS_INFO[c.className].subclass]} disabled={subclassLocked} onChange={(v) => set('subclass', v)} />
          </Label>
          <Label text="Species (เผ่าพันธุ์)"><ChoiceField value={c.species} options={SPECIES} onChange={changeSpecies} /></Label>
          <Label text="Background (ภูมิหลัง)"><ChoiceField value={c.background} options={BACKGROUNDS} onChange={changeBackground} /></Label>
          <Label text="Alignment"><TextInput value={c.alignment} onChange={(v) => set('alignment', v)} /></Label>
          <Label text="ผู้เล่น"><TextInput value={c.player} onChange={(v) => set('player', v)} /></Label>
          <Label text="แคมเปญ">
            {lobby.session?.role === 'player' ? (
              // In a room the campaign is the DM's choice.
              <p className="py-2 text-sm text-stone-400">🔒 {campaigns.find((x) => x.id === c.campaignId)?.name ?? '— ไม่มี —'} (ตามห้องของ DM)</p>
            ) : (
              <Select
                value={c.campaignId ?? ''}
                options={[{ value: '', label: '— ไม่มี —' }, ...campaigns.map((x) => ({ value: x.id, label: x.name }))]}
                onChange={(v) => set('campaignId', v || null)}
              />
            )}
          </Label>
        </div>
        <p className="mt-2 text-xs text-stone-500">เปลี่ยน Class แล้ว Saving Throw และ Spellcasting จะถูกตั้งให้ตาม Class · เลือก Background แล้วจะได้ Skill และ Feat ของ Background ให้อัตโนมัติ</p>
      </Section>

      <Section title="Feats">
        <div className="flex flex-wrap gap-x-4">
          {ORIGIN_FEATS.map((f) => (
            <Checkbox key={f} checked={c.feats.includes(f)} onChange={(on) => toggleFeat(f, on)} label={f} />
          ))}
        </div>
        <Label text="Feat อื่นๆ (คั่นด้วย ,)" className="mt-2">
          <TextInput
            value={c.feats.filter((f) => !(ORIGIN_FEATS as readonly string[]).includes(f)).join(', ')}
            onChange={(v) => set('feats', [
              ...c.feats.filter((f) => (ORIGIN_FEATS as readonly string[]).includes(f)),
              ...v.split(',').map((x) => x.trim()).filter(Boolean),
            ])}
          />
        </Label>
        {isSrdSpecies(c.species) && SPECIES_INFO[c.species].extraOriginFeat && (
          <p className="mt-1 text-xs text-stone-500">Human ได้ Origin Feat เพิ่ม 1 อัน (Versatile) นอกจาก Feat ของ Background</p>
        )}
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
                disabled={!freeEdit}
                onChange={(on) => toggleSave(a, on)}
                label={<span className="text-xs">Save {formatModifier(s.saves[a])}</span>}
              />
            </div>
          ))}
        </div>
      </Section>

      <Section title="Skills">
        <p className="mb-2 text-xs text-stone-500">
          แตะเพื่อสลับ: ○ → Proficient ● {(freeEdit || maxExpertise(c.className, c.level) > 0) && '→ Expertise ★'} ·
          เลือกจาก Class ได้ {CLASS_INFO[c.className].skillCount} อย่าง
          {maxExpertise(c.className, c.level) > 0 && ` · Expertise ได้ ${maxExpertise(c.className, c.level)} อย่าง`}
        </p>
        <ul className="divide-y divide-stone-700">
          {SKILLS.map((skill) => {
            const level = c.skills[skill] ?? 'none'
            return (
              <li key={skill}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-2 text-left"
                  onClick={() => cycleSkill(skill)}
                >
                  <span className={level === 'none' ? 'text-stone-300' : 'font-bold text-amber-300'}>
                    <span className="inline-block w-5">{level === 'proficient' ? '●' : level === 'expertise' ? '★' : '○'}</span>
                    {skill} <span className="text-xs font-normal text-stone-500">{ABILITY_LABEL[SKILL_ABILITY[skill]].short}</span>
                    {backgroundSkills.includes(skill) && <span className="ml-1 rounded bg-amber-900 px-1 text-xs font-normal text-amber-200">Background</span>}
                    {!backgroundSkills.includes(skill) && classChoices.includes(skill) && <span className="ml-1 rounded bg-stone-700 px-1 text-xs font-normal text-stone-300">Class</span>}
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
          <Label text={c.acAuto ? 'AC (คำนวณ)' : 'AC'}>
            {c.acAuto && equipment
              ? <div className="rounded-lg border border-stone-700 bg-stone-900 px-3 py-2 text-center text-lg font-bold">{applyAutoAC(c, equipment).ac}</div>
              : <NumberInput value={c.ac} min={1} max={40} onChange={(v) => set('ac', v)} />}
          </Label>
          <Label text="Speed (ft.)"><NumberInput value={c.speed} min={0} max={200} onChange={(v) => set('speed', v)} /></Label>
        </div>
        <div className="mt-2 flex items-end gap-3">
          <div className="flex-1">
            <Checkbox checked={!!c.acAuto} onChange={(v) => set('acAuto', v || undefined)} label="คำนวณ AC จากเกราะ/Shield ที่สวม (ใน Inventory)" />
          </div>
          {c.acAuto && (
            <Label text="โบนัส AC" className="w-24">
              <NumberInput value={c.acBonus ?? 0} min={-10} max={20} onChange={(v) => set('acBonus', v || undefined)} />
            </Label>
          )}
        </div>
        {c.acAuto && equipment && <p className="text-xs text-stone-500">{characterArmorClass(c, equipment).formula} · โบนัส AC: ของวิเศษ เช่น Ring of Protection, เกราะ +1</p>}
        <button type="button" className="mt-2 text-sm text-amber-400 underline" onClick={() => set('hp', { ...c.hp, max: suggestedMaxHp(c) })}>
          ใช้ Max HP แบบค่าเฉลี่ย: {suggestedMaxHp(c)}
        </button>
        <p className="text-xs text-stone-500">ถ้าทอยเต๋า HP ให้ใส่เอง · เปลี่ยน Species/Level แล้วกดปุ่มนี้อีกครั้ง (Wood Elf: Speed 35)</p>

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
        <div className="mt-3 flex items-center justify-between">
          <span className="text-sm text-stone-400">Spell Slots (สูงสุด) ต่อ Level คาถา</span>
          <button type="button" className="text-sm text-amber-400 underline" onClick={() => set('spellSlots', slotsFor(c.className, c.level))}>
            ตั้งตามตาราง {c.className} {c.level}
          </button>
        </div>
        <div className="mt-1 grid grid-cols-5 gap-2">
          {c.spellSlots.map((slot, i) => (
            <Label key={i} text={`Lv${i + 1}`}>
              <NumberInput value={slot.max} min={0} max={9} onChange={(v) => set('spellSlots', c.spellSlots.map((x, j) => (j === i ? { max: v, used: Math.min(x.used, v) } : x)))} />
            </Label>
          ))}
        </div>
        <p className="mt-1 text-xs text-stone-500">เปลี่ยน Class หรือ Level แล้ว Spell Slots จะถูกตั้งตามตารางให้อัตโนมัติ</p>
      </Section>

      <Section
        title="ความสามารถที่ใช้ได้จำกัด"
        action={<Button className="text-sm" onClick={() => set('features', [...c.features, { id: newId(), name: '', max: 1, used: 0, recharge: 'long' }])}>+ เพิ่ม</Button>}
      >
        <p className="mb-2 text-xs text-stone-500">เช่น Second Wind, Rage, Channel Divinity, Bardic Inspiration: ใช้กี่ครั้ง และฟื้นตอนพักแบบไหน (2024: Second Wind, Rage, Channel Divinity, Wild Shape = Short Rest คืน 1, Long Rest คืนหมด)</p>
        <div className="space-y-2">
          {c.features.map((f, i) => {
            const update = (patch: Partial<typeof f>) => set('features', c.features.map((x, j) => (j === i ? { ...x, ...patch } : x)))
            return (
              <div key={f.id} className="grid grid-cols-[1fr_4rem_7rem_auto] items-end gap-2">
                <Label text="ชื่อ"><TextInput value={f.name} placeholder="Second Wind" onChange={(v) => update({ name: v })} /></Label>
                <Label text={f.pool ? 'แต้ม' : 'ครั้ง'}><NumberInput value={f.max} min={1} max={MAX_FEATURE_USES} onChange={(v) => update({ max: v, used: Math.min(f.used, v) })} /></Label>
                <Label text="ฟื้นเมื่อ">
                  <Select value={f.recharge} options={RECHARGE_OPTIONS} onChange={(v) => update({ recharge: v })} />
                </Label>
                <button type="button" className="px-2 pb-2 text-red-400" onClick={() => set('features', c.features.filter((_, j) => j !== i))}>✕</button>
                <div className="col-span-4 -mt-1">
                  <Checkbox checked={!!f.pool} onChange={(v) => update({ pool: v || undefined })} label={<span className="text-xs">แบบแต้ม ใช้ทีละหลายแต้มได้ (Lay On Hands, Focus Points, Sorcery Points)</span>} />
                </div>
              </div>
            )
          })}
        </div>
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

      <Button variant="danger" className="w-full" onClick={remove}>ลบตัวละคร</Button>

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
