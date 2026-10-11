// About page: credits and licenses (SRD 5.2.1 attribution is required by CC-BY-4.0).
import { useState } from 'react'
import { currentDevice, setDeviceName } from '../db/device'
import { Button, Section, TextInput } from '../ui/kit'

export default function About() {
  const [name, setName] = useState(currentDevice()?.name ?? '')
  const [saved, setSaved] = useState(false)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-amber-400">เกี่ยวกับแอป</h1>

      <Section title="อุปกรณ์นี้">
        <p className="mb-2 text-xs text-stone-400">ชื่อที่ผู้เล่นคนอื่นจะเห็นเมื่อเข้าห้องเล่นร่วมกัน (ฟีเจอร์ในอนาคต)</p>
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
          <a className="text-amber-400 underline" href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noreferrer">
            https://creativecommons.org/licenses/by/4.0/legalcode
          </a>.
        </p>
        <p className="mt-2 text-sm text-stone-400">
          ข้อมูลมอนสเตอร์ SRD มาจากโปรเจกต์{' '}
          <a className="text-amber-400 underline" href="https://github.com/5e-bits/5e-database" target="_blank" rel="noreferrer">5e-bits/5e-database</a>
          {' '}(ตัดเหลือเฉพาะค่าที่ใช้ในแอป) · คำอธิบายภาษาไทยเขียนขึ้นเอง ไม่ได้แปลจากต้นฉบับ
        </p>
      </Section>

      <Section title="เวอร์ชัน">
        <p className="text-sm text-stone-300">
          Build {new Date(__BUILD_TIME__).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
        </p>
        <p className="mt-1 text-xs text-stone-500">ติดตั้งลงหน้าจอหลักแล้วใช้ได้แม้ไม่มีอินเทอร์เน็ต เมื่อมีเวอร์ชันใหม่จะมีปุ่มให้กดอัปเดต</p>
      </Section>

      <Section title="ฟอนต์">
        <p className="text-sm text-stone-300">Noto Sans Thai, SIL Open Font License 1.1</p>
      </Section>
    </div>
  )
}
