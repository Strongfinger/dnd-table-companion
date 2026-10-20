// About page: credits and licenses (SRD 5.2.1 attribution is required by CC-BY-4.0).
import { useState } from 'react'
import { currentDevice, setDeviceName } from '../db/device'
import { resetDevice } from '../db/reset'
import iconCredits from '../data/item-icon-credits.json'
import { DND_TH_CREDIT } from '../model/dndTh'
import { Button, Section, TextInput } from '../ui/kit'
import { useEquipmentTh, useFeaturesTh, useMagicItemsTh, useMonstersTh, useSpellsTh } from './useSrdData'

/** game-icons.net authors behind the item pictures, most used first (CC BY 3.0 asks for each one's name). */
const ICON_AUTHORS = Object.entries(
  Object.values(iconCredits as Record<string, { author: string }>).reduce<Record<string, number>>((n, c) => ({ ...n, [c.author]: (n[c.author] ?? 0) + 1 }), {}),
).sort((a, b) => b[1] - a[1]).map(([author]) => author)

export default function About() {
  const [name, setName] = useState(currentDevice()?.name ?? '')
  const [saved, setSaved] = useState(false)
  const thaiSpells = useSpellsTh()
  const thaiFeats = Object.keys(useFeaturesTh()).length
  const thaiItems = Object.keys(useMagicItemsTh()).length
  const thaiGear = Object.keys(useEquipmentTh().items).length
  const thaiMonsters = Object.keys(useMonstersTh()).length

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-amber-400">เกี่ยวกับแอป</h1>

      <Section title="อุปกรณ์นี้">
        <p className="mb-2 text-xs text-stone-400">ชื่อที่ผู้เล่นคนอื่นเห็นในห้องเล่นร่วมกัน (แท็บ 🌐 ห้อง)</p>
        <div className="flex gap-2">
          <div className="flex-1"><TextInput value={name} onChange={(v) => { setName(v); setSaved(false) }} /></div>
          <Button onClick={async () => { setName((await setDeviceName(name)).name); setSaved(true) }}>{saved ? '✓ บันทึกแล้ว' : 'บันทึก'}</Button>
        </div>
      </Section>
      <Section title="DND Table Companion">
        <p className="text-sm text-stone-300">
          ผู้ช่วยโต๊ะ D&amp;D สำหรับเล่นกับเพื่อนแบบเจอกัน: ใบตัวละคร, ตัวติดตามการต่อสู้ และตัวทอยลูกเต๋า
          ใช้กติกา D&amp;D 2024 (SRD 5.2.1) ข้อมูลทั้งหมดเก็บในเครื่องนี้เท่านั้น
        </p>
      </Section>

      <Section title="System Reference Document 5.2.1">
        <p className="text-sm text-stone-300">
          This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC,
          available at{' '}
          <a className="text-amber-400 underline" href="https://www.dndbeyond.com/srd" target="_blank" rel="noreferrer">https://www.dndbeyond.com/srd</a>.
          The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at{' '}
          <a className="break-all text-amber-400 underline" href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">
            https://creativecommons.org/licenses/by/4.0/legalcode
          </a>.
        </p>
        <p className="mt-2 text-sm text-stone-400">
          ข้อมูลมอนสเตอร์ SRD มาจากโปรเจกต์{' '}
          <a className="text-amber-400 underline" href="https://github.com/5e-bits/5e-database" target="_blank" rel="noreferrer">5e-bits/5e-database</a>
          {' '}(ตัดเหลือเฉพาะค่าที่ใช้ในแอป) · คำอธิบายภาษาไทยเขียนขึ้นเอง ไม่ได้แปลจากต้นฉบับ
        </p>
      </Section>

      {Object.keys(thaiSpells).length > 0 && (
        <Section title="คำแปลภาษาไทย">
          <p className="text-sm text-stone-300">
            คำแปลภาษาไทยของคาถา SRD 5.2.1 ({Object.keys(thaiSpells).length} คาถา){thaiFeats > 0 && `, Feat และความสามารถของ Class/Species (${thaiFeats})`}{thaiItems > 0 && `, ไอเทมเวท (${thaiItems} ชิ้น)`}{thaiGear > 0 && `, อุปกรณ์ (${thaiGear} ชิ้น)`}{thaiMonsters > 0 && `, Stat block มอนสเตอร์ (${thaiMonsters} ตัว)`}, Rules Glossary โดย{' '}
            <a className="text-amber-400 underline" href={DND_TH_CREDIT.url} target="_blank" rel="noreferrer">{DND_TH_CREDIT.name} (dnd-th.com)</a>
            {' '}ใช้ภายใต้สัญญาอนุญาต{' '}
            <a className="text-amber-400 underline" href={DND_TH_CREDIT.licenseUrl} target="_blank" rel="noreferrer">{DND_TH_CREDIT.license}</a>.
            {' '}ใช้โดยได้รับอนุญาตจาก DND-TH (13 ต.ค. 2569) แอปเลือกเฉพาะเนื้อหา 2024 ที่อยู่ใน SRD 5.2.1 และจัดรูปแบบใหม่ (ตัดลิงก์, แยกย่อหน้า Higher Level, ตัดชื่อบุคคลที่ไม่อยู่ใน SRD เช่น Tasha, Heward) ข้อมูลส่วนนี้ใช้สัญญาอนุญาตเดียวกัน
            {' '}พบคำผิดหรือคำแปลแปลกๆ แจ้ง DND-TH ได้ที่เว็บไซต์ของเขา
          </p>
        </Section>
      )}

      <Section title="รูปไอเทม">
        <p className="text-sm text-stone-300">
          รูปอาวุธ เกราะ และของที่ปาร์ตี้ใช้บ่อย วาดด้วย Gemini สำหรับแอปนี้ ·
          รูปของใช้ เครื่องมือ พิษ Focus แพ็ก และกระสุน ({Object.keys(iconCredits).length} ชิ้น) ทำจากไอคอนของ{' '}
          <a className="text-amber-400 underline" href="https://game-icons.net" target="_blank" rel="noreferrer">game-icons.net</a>
          {' '}โดย {ICON_AUTHORS.join(', ')} ใช้ภายใต้สัญญาอนุญาต{' '}
          <a className="text-amber-400 underline" href="https://creativecommons.org/licenses/by/3.0/" target="_blank" rel="noreferrer">CC BY 3.0</a>
          {' '}(แต่งสีและพื้นหลังใหม่)
        </p>
      </Section>

      <Section title="เวอร์ชัน">
        <p className="text-sm text-stone-300">
          Build {new Date(__BUILD_TIME__).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        <p className="mt-1 text-xs text-stone-500">ติดตั้งลงหน้าจอหลักแล้วใช้ได้แม้ไม่มีอินเทอร์เน็ต เมื่อมีเวอร์ชันใหม่จะมีปุ่มให้กดอัปเดต</p>
      </Section>

      <Section title="ทดลองห้องเล่นร่วมกัน (ทดสอบ)">
        <a href="#/lab" className="text-sm text-amber-400 underline">🧪 เปิดหน้าทดสอบการเชื่อมต่อ</a>
      </Section>

      <Section title="สำรอง / กู้คืนข้อมูล">
        <p className="text-sm text-stone-300">เก็บตัวละคร แคมเปญ การต่อสู้ สมุด และบันทึกทั้งหมดเป็นไฟล์เดียว แล้วนำกลับมาใส่ได้</p>
        <a href="#/backup" className="mt-2 inline-block text-sm text-amber-400 underline">💾 เปิดหน้าสำรอง / กู้คืน</a>
      </Section>

      <ResetDevice />

      <Section title="ฟอนต์">
        <p className="text-sm text-stone-300">Noto Sans Thai, SIL Open Font License 1.1</p>
      </Section>
    </div>
  )
}

/** Wipe this device's data (asks to type a word first: it can't be undone). */
function ResetDevice() {
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = typed.trim() === 'ล้าง'

  async function reset() {
    if (!ok || busy) return
    setBusy(true)
    await resetDevice()
    // Start the app again from the character list, as on a new device.
    window.location.hash = '#/'
    window.location.reload()
  }

  return (
    <Section title="ล้างข้อมูลในเครื่องนี้">
      <p className="text-sm text-stone-300">
        ลบทุกอย่างที่แอปเก็บไว้ในเครื่องนี้: ตัวละคร การต่อสู้ บันทึก แคมเปญ ชื่ออุปกรณ์ และห้องที่เข้าอยู่
        แอปจะเริ่มใหม่เหมือนเพิ่งติดตั้ง · เครื่องอื่นไม่ได้รับผลกระทบ (ต้องล้างแยกทีละเครื่อง)
      </p>
      <p className="mt-1 text-xs text-amber-300">อยากเก็บข้อมูลไว้? <a href="#/backup" className="underline">💾 สำรองข้อมูล</a> เป็นไฟล์ก่อน แล้วค่อยกู้คืนหลังล้าง</p>
      {!open ? (
        <Button variant="danger" className="mt-3 w-full" onClick={() => setOpen(true)}>🗑 ล้างข้อมูลทั้งหมดในเครื่องนี้…</Button>
      ) : (
        <div className="mt-3 space-y-2 rounded-lg bg-red-950/60 p-3">
          <p className="text-sm">ย้อนกลับไม่ได้ พิมพ์คำว่า <b>ล้าง</b> เพื่อยืนยัน</p>
          <TextInput value={typed} placeholder="ล้าง" onChange={setTyped} />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => { setOpen(false); setTyped('') }}>ยกเลิก</Button>
            <Button variant="danger" className={`flex-1 ${ok ? '' : 'opacity-40'}`} onClick={reset}>{busy ? 'กำลังล้าง…' : 'ล้างเลย'}</Button>
          </div>
        </div>
      )}
    </Section>
  )
}
