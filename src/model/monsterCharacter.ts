// A monster or NPC becomes a character, so a player can run it (a companion, a charmed foe, a hireling)
// or the DM can send it as a file. SRD stat blocks keep everything: abilities, AC, HP, speed, saves,
// skills, and the traits/actions as text. A custom NPC (no stat block) keeps what the tracker knows.
import { abilityModifier, ABILITIES, formatModifier, SKILL_ABILITY, SKILLS, type Ability, type ProficiencyLevel, type Skill } from '../rules'
import { createCharacter, type Character } from './character'
import type { Combatant } from './encounter'
import type { FullMonster, StatBlockEntry } from './monsterDetails'
import { formatCR } from './monsters'

const CREDIT = 'SRD 5.2.1 (CC-BY-4.0)'

/** "9d8 + 18" → 9 dice of d8. Falls back to one d8 for a formula it can't read. */
export function hitDiceOf(hpRoll: string): { dice: number; size: number } {
  const m = hpRoll.match(/^\s*(\d+)\s*d\s*(\d+)/i)
  const size = m ? Number(m[2]) : 8
  return { dice: m ? Math.max(1, Number(m[1])) : 1, size: [4, 6, 8, 10, 12, 20].includes(size) ? size : 8 }
}

/** Walking speed from "30 ft., Fly 60 ft." (other speeds stay in the features text). */
function walkSpeed(speed: string): number {
  const m = speed.match(/(\d+)\s*ft/)
  return m ? Math.min(200, Number(m[1])) : 30
}

/** A stat block's skill bonus as a proficiency level: twice the PB above the modifier = Expertise. */
function skillLevel(bonus: number, mod: number, pb: number): ProficiencyLevel {
  return bonus - mod >= 2 * pb ? 'expertise' : 'proficient'
}

function entryText(e: StatBlockEntry): string {
  const spells = (e.spells ?? []).map((g) => `${g.usage}: ${g.names.join(', ')}`).join('\n')
  return `${e.name}${e.usage ? ` (${e.usage})` : ''}. ${e.text}${spells ? `\n${spells}` : ''}`
}

function section(title: string, entries: StatBlockEntry[]): string {
  return entries.length ? `【${title}】\n${entries.map(entryText).join('\n')}` : ''
}

/**
 * An SRD monster as a character. `hp`: the copy's current HP (e.g. from a fight); defaults to full.
 * Its Hit Dice become its level (at most 20), so Short Rest Hit Dice work like the stat block's.
 */
export function characterFromMonster(m: FullMonster, opts: { name?: string; hp?: { max: number; current: number } } = {}): Character {
  const scores = Object.fromEntries(ABILITIES.map((a, i) => [a, m.scores[i]])) as Record<Ability, number>
  const mod = (a: Ability) => abilityModifier(scores[a])
  const skills: Partial<Record<Skill, ProficiencyLevel>> = {}
  // Stat block bonuses the sheet can't show exactly (not mod + PB or mod + 2×PB): listed in the notes.
  const odd: string[] = []
  for (const s of m.skills) {
    const skill = SKILLS.find((x) => x === s.name)
    if (!skill) continue
    const smod = abilityModifier(scores[SKILL_ABILITY[skill]])
    skills[skill] = skillLevel(s.bonus, smod, m.pb)
    if (s.bonus - smod !== m.pb && s.bonus - smod !== 2 * m.pb) odd.push(`${skill} ${formatModifier(s.bonus)}`)
  }
  for (const a of ABILITIES) {
    const save = m.saves[a]
    if (save !== undefined && save !== mod(a) && save - mod(a) !== m.pb) odd.push(`${a.toUpperCase()} Save ${formatModifier(save)}`)
  }
  const hd = hitDiceOf(m.hpRoll)
  const max = Math.min(999, Math.max(1, opts.hp?.max ?? m.hp))
  const defenses = [
    m.vulnerabilities.length ? `Vulnerabilities: ${m.vulnerabilities.join(', ')}` : '',
    m.resistances.length ? `Resistances: ${m.resistances.join(', ')}` : '',
    m.immunities.length ? `Immunities: ${m.immunities.join(', ')}` : '',
    m.conditionImmunities.length ? `Condition Immunities: ${m.conditionImmunities.join(', ')}` : '',
  ].filter(Boolean)
  return createCharacter({
    name: (opts.name ?? m.name).trim().slice(0, 100) || m.name,
    // className is required by the sheet; a monster shows "Monster · CR x" instead (see classLabel).
    className: 'Fighter',
    level: Math.min(20, hd.dice),
    species: `${m.size} ${m.type}`.trim().slice(0, 100),
    alignment: m.alignment.slice(0, 100),
    scores,
    saveProficiencies: ABILITIES.filter((a) => m.saves[a] !== undefined && m.saves[a] !== mod(a)),
    skills,
    hp: { max, current: Math.min(max, Math.max(0, opts.hp?.current ?? max)), temp: 0 },
    ac: Math.min(40, Math.max(1, m.ac)),
    speed: walkSpeed(m.speed),
    monster: { cr: m.cr, pb: m.pb, hitDie: hd.size, source: m.name },
    proficienciesText: [
      `Speed: ${m.speed}`,
      `Senses: ${[...m.senses, `Passive Perception ${m.passivePerception}`].join(', ')}`,
      `Languages: ${m.languages || '—'}`,
      ...defenses,
      m.gear ? `Gear: ${m.gear}` : '',
    ].filter(Boolean).join('\n'),
    featuresText: [
      section('Traits', m.traits),
      section('Actions', m.actions),
      section('Bonus Actions', m.bonusActions),
      section('Reactions', m.reactions),
      section('Legendary Actions', m.legendaryActions),
    ].filter(Boolean).join('\n\n'),
    notes: [
      `แปลงจาก ${m.name} (CR ${formatCR(m.cr)}) · ${CREDIT}`,
      'Initiative = DEX modifier (ข้อมูล SRD ยังไม่มีค่า Initiative ของ 2024) ปรับได้ที่ แก้ไข',
      hd.dice > 20 ? `Hit Dice จริง ${hd.dice}d${hd.size} (แอปเก็บได้สูงสุด 20 ลูก)` : '',
      odd.length ? `ค่าตาม Stat block ที่ใบตัวละครแสดงต่างไป: ${odd.join(', ')}` : '',
    ].filter(Boolean).join('\n'),
  })
}

/** A tracker NPC/monster with no SRD stat block: name, AC and HP only (abilities 10 until edited). */
export function characterFromCombatant(c: Pick<Combatant, 'name' | 'ac' | 'hp'>): Character {
  const max = Math.min(999, Math.max(1, c.hp.max))
  return createCharacter({
    name: c.name.trim().slice(0, 100) || 'NPC',
    className: 'Fighter',
    level: 1,
    hp: { max, current: Math.min(max, Math.max(0, c.hp.current)), temp: 0 },
    ac: Math.min(40, Math.max(1, c.ac)),
    monster: { cr: 0, pb: 2, hitDie: 8, source: 'NPC' },
    notes: 'แปลงจาก NPC ในการต่อสู้ (ใส่ Ability Scores และความสามารถเองได้ที่ แก้ไข)',
  })
}

/** "Rogue 3", or "Monster · CR 1/4" for a creature played as a character. */
export function classLabel(c: Pick<Character, 'className' | 'level' | 'monster'>): string {
  if (!c.monster) return `${c.className} ${c.level}`
  return c.monster.source === 'NPC' ? 'NPC' : `Monster · CR ${formatCR(c.monster.cr)}`
}
