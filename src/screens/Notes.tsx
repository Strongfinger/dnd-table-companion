// The sheet's notes, edited right where they are: tap "แก้ไข" (or the note itself), type, then
// "บันทึก" — the buttons sit beside the title, so a player never has to scroll to the top of the
// sheet or through the whole edit page. In a live room the change goes to the DM like other sheet edits.
import { useState } from 'react'
import { useLobby } from '../app/useLobby'
import { updateCharacter } from '../db/characters'
import type { Character } from '../model/character'
import { Button, Section } from '../ui/kit'

export default function Notes({ c }: { c: Character }) {
  const lobby = useLobby()
  // null = just reading; a string = the text being typed (not saved yet).
  const [draft, setDraft] = useState<string | null>(null)

  async function save() {
    if (draft === null) return
    const text = draft
    // Start from the newest saved copy; no change means nothing is saved.
    await updateCharacter(c.id, (latest) => ({ character: latest.notes === text ? latest : { ...latest, notes: text }, text: '' }))
    lobby.shareSheet(c.id)
    setDraft(null)
  }

  const action = draft === null
    ? <Button className="px-3 py-1 text-sm" onClick={() => setDraft(c.notes)}>✏️ แก้ไข</Button>
    : (
      <div className="flex gap-2">
        <Button className="px-3 py-1 text-sm" onClick={() => setDraft(null)}>ยกเลิก</Button>
        <Button variant="primary" className="px-3 py-1 text-sm" onClick={save}>บันทึก</Button>
      </div>
    )

  return (
    <Section title="โน้ต" action={action}>
      {draft !== null ? (
        // A fixed height that scrolls inside, so the buttons above stay on screen even for long notes.
        <textarea
          autoFocus
          rows={8}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="max-h-[50vh] w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base text-stone-100 focus:border-amber-400 focus:outline-none"
        />
      ) : (
        <button type="button" onClick={() => setDraft(c.notes)} className="block w-full text-left">
          {c.notes.trim()
            ? <p className="whitespace-pre-wrap text-stone-200">{c.notes}</p>
            : <p className="text-sm text-stone-500">ยังไม่มีโน้ต แตะเพื่อเขียน</p>}
        </button>
      )}
    </Section>
  )
}
