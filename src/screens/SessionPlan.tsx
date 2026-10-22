// Session plans (Phase 3.6), shown on Session pages of the notebook:
// - ScenesView: at the table. Scenes in order with read-aloud text, notes with [[links]], a checklist and
//   the prepared fight. Scenes and checklist items are ticked off right here (saved at once).
//   Afterwards, unplayed scenes move to a new Session page for next time.
// - ScenesEditor: preparing. Add, order, fill in and remove scenes; link or create a fight per scene.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { go } from '../app/router'
import { getEncounter, listEncounters, saveEncounter } from '../db/encounters'
import { saveNote } from '../db/notes'
import { createEncounter } from '../model/encounter'
import { createNote, type Note } from '../model/note'
import { addCheck, createScene, moveScene, progress, removeCheck, setCheck, splitUnplayed, updateScene, type Scene } from '../model/sessionPlan'
import { Button, TextInput } from '../ui/kit'
import LinkedText from '../ui/LinkedText'
import PinButton from './PinButton'

const STATUS = { setup: 'เตรียมไว้', active: 'กำลังสู้', ended: 'จบแล้ว' }

/** The plan at the table: tick scenes and checklist items, read the boxed text, open the fight. */
export function ScenesView({ note, pages, onChange, onFollow, onOpen, focusSceneId }: {
  /** A pinned scene: starts open and scrolls into view. */
  focusSceneId?: string
  note: Note
  pages: Note[]
  onChange: (n: Note) => void
  onFollow: (title: string) => void
  onOpen: (id: string) => void
}) {
  // The first scene not played yet starts open.
  const [open, setOpen] = useState<string | null>(() => focusSceneId ?? note.scenes.find((s) => !s.done)?.id ?? null)
  const [carried, setCarried] = useState<Note | null>(null)
  useEffect(() => {
    if (focusSceneId) document.getElementById(`scene-${focusSceneId}`)?.scrollIntoView({ block: 'start' })
  }, [focusSceneId])
  if (note.scenes.length === 0) return null
  const p = progress(note.scenes)
  const setScene = (id: string, patch: Partial<Scene>) => onChange({ ...note, scenes: updateScene(note.scenes, id, patch) })

  /** Unplayed scenes go to a new Session page (next time); this page keeps what was played. */
  async function carryOver() {
    const { played, carried: rest } = splitUnplayed(note.scenes)
    const next = await saveNote({ ...createNote(note.campaignId, Date.now(), 'session', `${note.title || 'เซสชัน'} (ต่อ)`), scenes: rest })
    onChange({ ...note, scenes: played })
    setCarried(next)
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-amber-400">🗺 แผนเซสชัน</h3>
        <span className="text-xs text-stone-400">เล่นแล้ว {p.done}/{p.total} ฉาก</span>
      </div>
      {note.scenes.map((s, i) => {
        const isOpen = open === s.id
        return (
          <div key={s.id} id={`scene-${s.id}`} className={`rounded-lg border ${s.done ? 'border-stone-800 bg-stone-900/50' : 'border-stone-700 bg-stone-900'}`}>
            <div className="flex items-center gap-2 p-2">
              <input
                type="checkbox"
                className="h-5 w-5 accent-amber-400"
                aria-label={`เล่นฉาก ${s.title} แล้ว`}
                checked={s.done}
                onChange={(e) => {
                  const done = e.target.checked
                  setScene(s.id, { done })
                }}
              />
              <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} className={`flex-1 text-left font-bold ${s.done ? 'text-stone-500 line-through' : ''}`}>
                {i + 1}. {s.title || '(ฉากไม่มีชื่อ)'}
                {s.checklist.length > 0 && <span className="ml-2 text-xs font-normal text-stone-400">☑ {s.checklist.filter((c) => c.done).length}/{s.checklist.length}</span>}
                {s.fightId && <span className="ml-1 text-xs">⚔️</span>}
              </button>
              <span className="text-stone-500">{isOpen ? '▲' : '▼'}</span>
              <PinButton campaignId={note.campaignId} pin={{ noteId: note.id, sceneId: s.id }} />
            </div>
            {isOpen && (
              <div className="space-y-2 border-t border-stone-800 p-3 text-sm">
                {s.readAloud && (
                  <blockquote className="whitespace-pre-line rounded-lg border-l-4 border-amber-500 bg-amber-950/40 p-3 text-base leading-relaxed text-amber-50">
                    {s.readAloud}
                  </blockquote>
                )}
                {s.notes && <div className="whitespace-pre-line leading-relaxed"><LinkedText text={s.notes} pages={pages} campaignId={note.campaignId} onFollow={onFollow} /></div>}
                {s.checklist.length > 0 && (
                  <ul className="space-y-1">
                    {s.checklist.map((c) => (
                      <li key={c.id}>
                        <label className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 accent-amber-400"
                            checked={c.done}
                            onChange={(e) => {
                              const done = e.target.checked
                              setScene(s.id, setCheck(s, c.id, done))
                            }}
                          />
                          <span className={c.done ? 'text-stone-500 line-through' : ''}><LinkedText text={c.text} pages={pages} campaignId={note.campaignId} onFollow={onFollow} /></span>
                        </label>
                      </li>
                    ))}
                  </ul>
                )}
                {s.fightId && <SceneFight fightId={s.fightId} />}
              </div>
            )}
          </div>
        )
      })}
      {carried ? (
        <p className="text-sm text-emerald-300">✓ ย้ายฉากที่ยังไม่เล่นไปหน้าใหม่แล้ว · <button type="button" className="underline" onClick={() => onOpen(carried.id)}>เปิด "{carried.title}"</button></p>
      ) : p.done > 0 && p.done < p.total && (
        <Button className="w-full text-sm" onClick={carryOver}>➡️ ย้ายฉากที่ยังไม่เล่นไปเซสชันถัดไป</Button>
      )}
    </section>
  )
}

/** A scene's prepared fight: its name and state, one tap to the tracker. */
function SceneFight({ fightId }: { fightId: string }) {
  const fight = useLiveQuery(() => getEncounter(fightId).then((e) => e ?? null), [fightId])
  if (fight === undefined) return null
  if (fight === null) return <p className="text-xs text-stone-500">⚔️ การต่อสู้ที่ผูกไว้ถูกลบไปแล้ว</p>
  return (
    <button type="button" onClick={() => go(`/fight/${fight.id}`)} className="w-full rounded-lg bg-red-950 px-3 py-2 text-left text-sm hover:bg-red-900">
      ⚔️ <b>{fight.name}</b> <span className="text-xs text-red-200">({STATUS[fight.status]} · {fight.combatants.length} ตัว)</span>
      <span className="float-right">เปิดการต่อสู้ ›</span>
    </button>
  )
}

/** Preparing the plan: add, order, fill in and remove scenes. */
export function ScenesEditor({ note, onScenes }: { note: Note; onScenes: (scenes: Scene[]) => void }) {
  const [newTitle, setNewTitle] = useState('')
  const [checkText, setCheckText] = useState<Record<string, string>>({})
  const fights = (useLiveQuery(listEncounters) ?? []).filter((e) => e.status !== 'ended' && (!note.campaignId || e.campaignId === note.campaignId))
  const scenes = note.scenes
  const set = (id: string, patch: Partial<Scene>) => onScenes(updateScene(scenes, id, patch))

  async function newFight(s: Scene) {
    const e = await saveEncounter(createEncounter(s.title || 'การต่อสู้', note.campaignId))
    set(s.id, { fightId: e.id })
  }

  const area = 'w-full rounded-lg border border-stone-600 bg-stone-950 px-3 py-2 text-base leading-relaxed'
  return (
    <section className="space-y-3 rounded-lg border border-stone-700 p-3">
      <h3 className="font-bold text-amber-400">🗺 แผนเซสชัน (ฉาก)</h3>
      {scenes.map((s, i) => (
        <div key={s.id} className="space-y-2 rounded-lg bg-stone-900 p-2">
          <div className="flex items-center gap-1">
            <span className="text-sm text-stone-400">{i + 1}.</span>
            <div className="min-w-0 flex-1"><TextInput value={s.title} placeholder="ชื่อฉาก เช่น ถูกซุ่มโจมตีบนถนน" onChange={(title) => set(s.id, { title })} /></div>
            <button type="button" aria-label="เลื่อนขึ้น" className="rounded px-2 py-1 hover:bg-stone-700" onClick={() => onScenes(moveScene(scenes, s.id, -1))}>▲</button>
            <button type="button" aria-label="เลื่อนลง" className="rounded px-2 py-1 hover:bg-stone-700" onClick={() => onScenes(moveScene(scenes, s.id, 1))}>▼</button>
            <button type="button" aria-label="ลบฉาก" className="rounded px-2 py-1 text-red-300 hover:bg-red-950" onClick={() => onScenes(scenes.filter((x) => x.id !== s.id))}>✕</button>
          </div>
          <textarea aria-label="ข้อความอ่านให้ผู้เล่นฟัง" className={area} rows={3} placeholder="📢 ข้อความอ่านให้ผู้เล่นฟัง (ไม่บังคับ)" value={s.readAloud} onChange={(e) => set(s.id, { readAloud: e.target.value })} />
          <textarea aria-label="โน้ตของฉาก" className={area} rows={3} placeholder="โน้ต DM: เกิดอะไรขึ้น ใครอยู่ [[ชื่อ NPC]] …" value={s.notes} onChange={(e) => set(s.id, { notes: e.target.value })} />
          <div className="space-y-1">
            {s.checklist.map((c) => (
              <div key={c.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">☐ {c.text}</span>
                <button type="button" aria-label="ลบรายการ" className="text-red-300" onClick={() => set(s.id, removeCheck(s, c.id))}>✕</button>
              </div>
            ))}
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <TextInput value={checkText[s.id] ?? ''} placeholder="เบาะแส/สิ่งที่ต้องบอก เช่น ให้แผนที่" onChange={(v) => setCheckText({ ...checkText, [s.id]: v })} />
              </div>
              <Button className="text-sm" onClick={() => { set(s.id, addCheck(s, checkText[s.id] ?? '')); setCheckText({ ...checkText, [s.id]: '' }) }}>+ รายการ</Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-stone-400">⚔️ การต่อสู้:</span>
            <select aria-label="การต่อสู้ของฉาก" className="min-w-0 flex-1 rounded-lg border border-stone-600 bg-stone-950 px-2 py-1.5 text-base" value={s.fightId ?? ''} onChange={(e) => set(s.id, { fightId: e.target.value || null })}>
              <option value="">— ไม่มี —</option>
              {fights.map((f) => <option key={f.id} value={f.id}>{f.name} ({STATUS[f.status]})</option>)}
              {s.fightId && !fights.some((f) => f.id === s.fightId) && <option value={s.fightId}>(การต่อสู้ที่ผูกไว้)</option>}
            </select>
            {!s.fightId && <Button className="text-sm" onClick={() => newFight(s)}>+ สร้างใหม่</Button>}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <div className="min-w-0 flex-1"><TextInput value={newTitle} placeholder="ชื่อฉากใหม่" onChange={setNewTitle} /></div>
        <Button variant="primary" className="text-sm" onClick={() => { onScenes([...scenes, createScene(newTitle)]); setNewTitle('') }}>+ เพิ่มฉาก</Button>
      </div>
    </section>
  )
}
