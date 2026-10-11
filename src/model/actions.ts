// Shared HP actions for a character, used by both the sheet's play panel and the combat tracker,
// so a PC takes damage the same way everywhere. Each returns the new character and a Thai log line.
import { applyDamage, concentrationDC, gainTempHp, heal, type Condition } from '../rules'
import type { Character } from './character'

export interface ActionResult {
  character: Character
  text: string
}

const hpText = (h: Character['hp']) => `HP ${h.current}/${h.max}${h.temp ? ` (+${h.temp} Temp)` : ''}`

export function damageCharacter(c: Character, amount: number, critical = false): ActionResult {
  const r = applyDamage(c, amount, critical)
  const atZero = c.hp.current === 0
  const notes: string[] = [`${c.name} โดน ${amount} ดาเมจ${critical ? ' (Critical)' : ''} → ${hpText(r.hp)}`]
  if (r.dead) notes.push('💀 ตาย (Massive Damage หรือ Death Save ล้มเหลว 3 ครั้ง)')
  else if (r.droppedToZero) notes.push('HP เหลือ 0: หมดสติ เริ่มทอย Death Save')
  else if (atZero) notes.push(`Death Save ล้มเหลว +${critical ? 2 : 1}`)
  if (c.concentration && (r.droppedToZero || r.dead)) notes.push(`🔮 Concentration (${c.concentration}) หลุดเพราะหมดสติ`)
  else if (c.concentration) notes.push(`🔮 ทอย CON Save DC ${concentrationDC(amount)} เพื่อรักษา Concentration (${c.concentration})`)
  // Dropping to 0 HP adds Unconscious and ends Concentration.
  const conditions: Condition[] = r.droppedToZero && !c.conditions.includes('Unconscious') ? [...c.conditions, 'Unconscious'] : c.conditions
  return {
    character: { ...c, hp: r.hp, deathSaves: r.deathSaves, conditions, concentration: r.droppedToZero ? '' : c.concentration },
    text: notes.join(' · '),
  }
}

export function healCharacter(c: Character, amount: number): ActionResult {
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
