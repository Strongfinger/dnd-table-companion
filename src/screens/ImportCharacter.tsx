// Bring a character in from a JSON file (or pasted text), with a preview before saving.
import { useState } from 'react'
import { go } from '../app/router'
import { getCharacter, saveCharacter, saveReceivedCharacter } from '../db/characters'
import { addLog } from '../db/log'
import { newId, type Character } from '../model/character'
import { MAX_IMPORT_BYTES, parseCharacterImport } from '../model/io'
import { deriveSheet, formatModifier } from '../rules'
import { Button, Section, Stat, TextArea } from '../ui/kit'
import { classLabel } from '../model/monsterCharacter'

export default function ImportCharacter() {
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ character: Character; warnings: string[]; existing: Character | null } | null>(null)

  async function check(content: string) {
    setPreview(null)
    const r = parseCharacterImport(content)
    if (!r.ok) return setError(r.error)
    setError('')
    // Same id = this character already lives on this device (e.g. a player's updated sheet).
    const existing = (await getCharacter(r.character.id)) ?? null
    setPreview({ ...r, existing })
  }

  async function pickFile(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_IMPORT_BYTES) return setError('ไฟล์ใหญ่เกินไป (เกิน 1 MB)')
    const content = await file.text()
    setText(content)
    check(content)
  }

  /**
   * 'first': not on this device yet, keep the file's id (so the player's phone and the DM's copy stay ONE
   * character: a live room matches sheets by id). 'replace': overwrite the copy with that id.
   * 'copy': keep both, the file becomes a separate character with a new id.
   */
  async function save(mode: 'first' | 'replace' | 'copy') {
    if (!preview) return
    const now = Date.now()
    const c = mode === 'copy' ? { ...preview.character, id: newId(), createdAt: now } : preview.character
    // A first import keeps the file's revision as-is (like a sheet received in a live room), so a player
    // who edits once more before joining still counts as newer than this copy.
    const saved = mode === 'first'
      ? (await saveReceivedCharacter(c, (stored) => !stored, c.campaignId)).stored
      : await saveCharacter(c)
    await addLog(saved.id, mode === 'replace' ? '📥 อัปเดตจากไฟล์ที่นำเข้า' : '📥 นำเข้าจากไฟล์')
    go(`/c/${saved.id}`)
  }

  const c = preview?.character
  const s = c ? deriveSheet(c) : null

  return (
    <div className="space-y-4">
      <a href="#/" className="text-sm text-stone-400">← ตัวละครทั้งหมด</a>
      <h1 className="text-2xl font-bold text-amber-400">นำเข้าตัวละคร</h1>

      <Section title="1. เลือกไฟล์ .json">
        <input
          type="file"
          accept=".json,application/json"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-amber-500 file:px-4 file:py-2 file:font-bold file:text-stone-900"
          onChange={(e) => pickFile(e.target.files?.[0])}
        />
        <p className="mt-3 mb-1 text-sm text-stone-400">หรือวางข้อความที่คัดลอกมา</p>
        <TextArea value={text} rows={4} onChange={setText} />
        <Button className="mt-2 w-full" onClick={() => check(text)}>ตรวจข้อมูล</Button>
        {error && <p className="mt-2 text-sm text-red-400">⚠️ {error}</p>}
      </Section>

      {c && s && preview && (
        <Section title="2. ตรวจสอบก่อนบันทึก">
          <p className="text-lg font-bold">{c.name}</p>
          <p className="mb-3 text-sm text-stone-400">
            {classLabel(c)}{c.species && ` · ${c.species}`}{c.background && ` · ${c.background}`}{c.player && ` · ผู้เล่น: ${c.player}`}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="HP" value={`${c.hp.current}/${c.hp.max}`} />
            <Stat label="AC" value={c.ac} />
            <Stat label="Initiative" value={formatModifier(s.initiative)} />
          </div>

          {preview.warnings.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-lg bg-stone-900 p-3 text-sm text-amber-300">
              {preview.warnings.map((w) => <li key={w}>⚠️ {w}</li>)}
            </ul>
          )}

          <div className="mt-4 space-y-2">
            {preview.existing ? (
              <>
                <p className="text-sm">ตัวละครนี้มีอยู่ในเครื่องแล้ว: <b>{preview.existing.name}</b> (Level {preview.existing.level})</p>
                <Button variant="primary" className="w-full" onClick={() => save('replace')}>🔄 แทนที่ของเดิมด้วยไฟล์นี้</Button>
                <Button className="w-full" onClick={() => save('copy')}>➕ เก็บทั้งคู่ (สร้างเป็นตัวใหม่)</Button>
              </>
            ) : (
              <Button variant="primary" className="w-full" onClick={() => save('first')}>📥 นำเข้าตัวละคร</Button>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}
