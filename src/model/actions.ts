// Shared HP actions for a character, used by both the sheet's play panel and the combat tracker,
// so a PC takes damage the same way everywhere. Each returns the new character and a Thai log line.
import { applyDamage, concentrationDC, gainTempHp, heal, rollDeathSave, type Condition } from '../rules'
import type { Character } from './character'

export interface ActionResult {
  character: Character
  text: string
}

const hpText = (h: Character['hp']) => `HP ${h.current}/${h.max}${h.temp ? ` (+${h.temp} Temp)` : ''}`

export function damageCharacter(c: Character, amount: number, critical = false): ActionResult {
  const r = applyDamage(c, amount, critical)
  const addedFailures = r.deathSaves.failures - c.deathSaves.failures
  const notes: string[] = [`${c.name} โดน ${amount} ดาเมจ${critical ? ' (Critical)' : ''} → ${hpText(r.hp)}`]
  if (r.dead) notes.push('💀 ตาย (Massive Damage หรือ Death Save ล้มเหลว 3 ครั้ง)')
  else if (r.droppedToZero) notes.push('HP เหลือ 0: หมดสติ เริ่มทอย Death Save')
  else if (addedFailures > 0) notes.push(`Death Save ล้มเหลว +${addedFailures}`)
  if (c.concentration && (r.droppedToZero || r.dead)) notes.push(`🔮 Concentration (${c.concentration}) หลุดเพราะหมดสติ`)
  else if (c.concentration) notes.push(`🔮 ทอย CON Save DC ${concentrationDC(amount)} เพื่อรักษา Concentration (${c.concentration})`)
  // Dropping to 0 HP adds Unconscious and ends Concentration.
  const conditions: Condition[] = r.droppedToZero && !c.conditions.includes('Unconscious') ? [...c.conditions, 'Unconscious'] : c.conditions
  return {
    character: { ...c, hp: r.hp, deathSaves: r.deathSaves, conditions, concentration: r.droppedToZero ? '' : c.concentration },
    text: notes.join(' · '),
  }
}

/** Dead = 3 failed death saves. Ordinary healing can't bring a dead character back. */
export const isDead = (c: Pick<Character, 'deathSaves' | 'hp'>) => c.hp.current === 0 && c.deathSaves.failures >= 3

export function healCharacter(c: Character, amount: number): ActionResult {
  if (isDead(c)) return { character: c, text: `${c.name} ตายแล้ว: การฮีลปกติชุบชีวิตไม่ได้ (ใช้ปุ่ม "ชุบชีวิต" สำหรับคาถาอย่าง Revivify)` }
  const r = heal(c, amount)
  // Regaining HP ends Unconscious from dropping to 0.
  const conditions = c.hp.current === 0 ? c.conditions.filter((x) => x !== 'Unconscious') : c.conditions
  return { character: { ...c, ...r, conditions }, text: `${c.name} ฮีล ${amount} → ${hpText(r.hp)}` }
}

export function tempHpCharacter(c: Character, amount: number): ActionResult {
  const r = gainTempHp(c, amount)
  const text = c.hp.temp >= amount ? `${c.name}: Temp HP ${amount} ไม่ซ้อนกัน ยังคง ${c.hp.temp}` : `${c.name} ได้ Temp HP ${amount}`
  return { character: { ...c, ...r }, text }
}

/** Record a death save roll (from the app or real dice). */
export function deathSaveCharacter(c: Character, d20: number, manual: boolean): ActionResult {
  const r = rollDeathSave(c, d20)
  const label = {
    success: 'สำเร็จ', failure: 'ล้มเหลว', stable: 'สำเร็จครบ 3: อาการคงที่ (Stable)',
    dead: '💀 ล้มเหลวครบ 3: ตาย', revived: '✨ Nat 20! ฟื้นขึ้นมา 1 HP',
  }[r.outcome]
  const conditions = r.outcome === 'revived' ? c.conditions.filter((x) => x !== 'Unconscious') : c.conditions
  return {
    character: { ...c, hp: r.hp, deathSaves: r.deathSaves, conditions },
    text: `${c.name} Death Save: ${manual ? 'ทอยเอง' : '🎲'} ${d20} → ${label}`,
  }
}

/** Bring a dead character back with 1 HP (e.g. the Revivify spell). */
export function reviveCharacter(c: Character): ActionResult {
  return {
    character: { ...c, hp: { ...c.hp, current: 1, temp: 0 }, deathSaves: { successes: 0, failures: 0 }, conditions: c.conditions.filter((x) => x !== 'Unconscious') },
    text: `✨ ${c.name} ถูกชุบชีวิต: HP 1/${c.hp.max}`,
  }
}
