import { describe, expect, it } from 'vitest'
import { buildEquipmentTh } from './equipmentTh'

const srd = {
  items: [
    { id: 'hand-crossbow', name: 'Hand Crossbow' }, { id: 'leather-armor', name: 'Leather Armor' },
    { id: 'greatclub', name: 'Greatclub' }, { id: 'rope', name: 'Rope', text: 'As a Utilize action…' },
    { id: 'thieves-tools', name: "Thieves' Tools", utilize: ['Pick a lock (DC 15)'] }, { id: 'malice', name: 'Malice', text: 'Poison' },
  ],
  properties: [{ name: 'Light' }, { name: 'Two-Handed' }],
  masteries: [{ name: 'Vex' }],
}
const vex = { id: 'vex', name: 'Vex', title: 'ก่อกวน', description: 'ได้ [เปรียบ (Advantage)](/x)' }

describe('buildEquipmentTh', () => {
  const r = buildEquipmentTh([
    { name: 'Crossbow, Hand', title: 'หน้าไม้มือ', description: '', property_details: [{ name: 'Light', name_th: 'เบา', description: 'ถือมือเดียว' }], mastery_details: vex },
    { name: 'Leather', title: 'เกราะหนัง', description: 'หนังต้มแข็ง (flavour the SRD lacks)' },
    { name: 'Great Club', title: 'กระบองใหญ่', description: '', property_details: [{ name: 'Two-Handed', name_th: 'สองมือ', description: 'ใช้สองมือ' }], mastery_details: vex },
    { name: 'Rope', title: 'เชือก', description: 'ผูก [เงื่อน](/x)' },
    { name: "Thieves' Tools", title: 'อุปกรณ์ขโมย', description: 'ใช้งานเฉพาะทาง', utilize: 'สะเดาะกุญแจ (DC 15)' },
  ], srd)
  if ('error' in r) throw new Error(r.error)

  it('matches names in any word order, without "Armor" or spaces; text only where the English has text', () => {
    expect(r.file.items).toEqual({
      'hand-crossbow': { name: 'หน้าไม้มือ' },
      'leather-armor': { name: 'เกราะหนัง' },
      greatclub: { name: 'กระบองใหญ่' },
      rope: { name: 'เชือก', text: 'ผูก เงื่อน' },
      'thieves-tools': { name: 'อุปกรณ์ขโมย', utilize: 'สะเดาะกุญแจ (DC 15)' },
    })
    expect(r.report.missing).toEqual(['Malice'])
  })

  it('collects each property and mastery once', () => {
    expect(r.file.properties).toEqual({ Light: { name: 'เบา', text: 'ถือมือเดียว' }, 'Two-Handed': { name: 'สองมือ', text: 'ใช้สองมือ' } })
    expect(r.file.masteries).toEqual({ Vex: { name: 'ก่อกวน', text: 'ได้ เปรียบ (Advantage)' } })
  })
})
