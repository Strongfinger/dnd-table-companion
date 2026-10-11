// The DM's initiative tracker for one fight: order, turns, HP, effects and the fight log.
// Rules live in src/rules (turns, play) and src/model (encounter, actions); this file wires them up.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { go } from '../app/router'
import { listCharacters, updateCharacter } from '../db/characters'
import { deleteEncounter, getEncounter, updateEncounter } from '../db/encounters'
import { addLog, listEncounterLog } from '../db/log'
import { isDead, type ActionResult } from '../model/actions'
import type { Character } from '../model/character'
import { conditionsToClear, rollInitiative, type Combatant, type Encounter, type MonsterResult } from '../model/encounter'
import { nextTurn, previousTurn, sortByInitiative, startCombat, startOfTurn } from '../rules'
import { Button, Section } from '../ui/kit'
import AddCombatants from './AddCombatants'
import CombatantRow from './CombatantRow'


export default function Tracker({ id }: { id: string }) {
  const e = useLiveQuery(() => getEncounter(id).then((x) => x ?? null), [id])
  const characters = useLiveQuery(listCharacters) ?? []
  const fightLog = useLiveQuery(() => listEncounterLog(id), [id]) ?? []
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (e === undefined) return null
  if (e === null) return <p className="text-center text-stone-400">ไม่พบการต่อสู้นี้</p>

  const enc = e
  const byId = new Map(characters.map((c) => [c.id, c]))
  /** Write to the fight log (and to the PC's own sheet log when it's about a PC). */
  const log = (text: string, characterId = '', round = enc.round) => addLog(characterId, text, { encounterId: enc.id, round })

  /**
   * Change the encounter starting from its newest saved copy (never a stale screen copy).
   * Dead PCs (3 failed death saves on their sheet) are marked defeated so turns skip them.
   */
  function update<R>(fn: (latest: Encounter) => { encounter: Encounter; result: R }) {
    return updateEncounter(enc.id, (latest) => {
      const combatants = latest.combatants.map((c) => {
        const ch = c.kind === 'pc' && c.characterId ? byId.get(c.characterId) : undefined
        return ch ? { ...c, defeated: isDead(ch) } : c
      })
      return fn({ ...latest, combatants })
    })
  }
  const patch = (fn: (latest: Encounter) => Partial<Encounter>) => update((x) => ({ encounter: { ...x, ...fn(x) }, result: null }))

  async function updateCombatant(cid: string, fn: (latest: Combatant) => MonsterResult) {
    const text = await update((x) => {
      let line = ''
      // Re-sort after every change: initiative and tiebreaks can change the order.
      const combatants = sortByInitiative(x.combatants.map((c) => {
        if (c.id !== cid) return c
        const r = fn(c)
        line = r.text
        return r.combatant
      }))
      return { encounter: { ...x, combatants }, result: line }
    })
    if (text) await log(text)
  }

  async function updatePc(characterId: string, fn: (latest: Character) => ActionResult) {
    const text = await updateCharacter(characterId, fn)
    if (text) await log(text, characterId)
  }

  /** Take tracker-applied conditions off PC sheets for these combatants (fight over / removed). */
  async function clearPcConditions(list: Combatant[]) {
    for (const c of list) {
      if (c.kind !== 'pc' || !c.characterId) continue
      const clear = conditionsToClear(c.effects, [])
      if (clear.length) await updateCharacter(c.characterId, (ch) => ({ character: { ...ch, conditions: ch.conditions.filter((x) => !clear.includes(x)) }, text: '' }))
    }
  }

  function setInitiative(cid: string, total: number, how: string) {
    const c = enc.combatants.find((x) => x.id === cid)!
    updateCombatant(cid, (m) => ({ combatant: { ...m, initiative: total }, text: `${c.name}: Initiative ${total} (${how})` }))
  }

  async function rollMonsters() {
    const lines = await update((x) => {
      const out: string[] = []
      const combatants = x.combatants.map((c) => {
        if (c.kind !== 'monster' || c.initiative !== null) return c
        const r = rollInitiative(c.initBonus)
        out.push(`${c.name}: Initiative ${r.total} (${r.how})`)
        return { ...c, initiative: r.total }
      })
      return { encounter: { ...x, combatants: sortByInitiative(combatants) }, result: out }
    })
    for (const line of lines ?? []) await log(line)
  }

  async function start() {
    const first = await update((x) => {
      const r = startCombat(x.combatants)
      const who = r.combatants.find((c) => c.id === r.state.activeId)
      const combatants = freshMonster(r.combatants, r.state.activeId)
      return { encounter: { ...x, combatants, status: 'active', round: 1, activeId: r.state.activeId }, result: { name: who?.name, combatants, activeId: r.state.activeId } }
    })
    if (first) await refreshTurn(first.activeId, first.combatants)
    await log('⚔️ เริ่มการต่อสู้ — รอบที่ 1 —', '', 1)
    if (first?.name) await log(`ตาของ ${first.name}`, '', 1)
  }

  /** Start of a creature's turn: Action, Bonus Action and Reaction come back. */
  async function refreshTurn(activeId: string | null, combatants: Combatant[]) {
    const who = combatants.find((c) => c.id === activeId)
    if (who?.kind === 'pc' && who.characterId) await updateCharacter(who.characterId, (ch) => ({ character: { ...ch, turn: startOfTurn() }, text: '' }))
  }
  const freshMonster = (list: Combatant[], activeId: string | null) =>
    list.map((c) => (c.id === activeId && c.kind === 'monster' ? { ...c, turn: startOfTurn() } : c))

  async function next() {
    const r = await update((x) => {
      const t = nextTurn(x.combatants, { round: x.round, activeId: x.activeId })
      const combatants = freshMonster(t.combatants, t.state.activeId)
      return { encounter: { ...x, combatants, round: t.state.round, activeId: t.state.activeId }, result: { t, before: x.combatants } }
    })
    if (!r) return
    await refreshTurn(r.t.state.activeId, r.t.combatants)
    // PC conditions live on the sheet too: when a timed condition runs out, take it off the sheet.
    for (const b of r.before) {
      if (b.kind !== 'pc' || !b.characterId) continue
      const after = r.t.combatants.find((x) => x.id === b.id)?.effects ?? []
      const clear = conditionsToClear(b.effects.filter((ef) => !after.some((x) => x.id === ef.id)), after)
      if (clear.length) await updateCharacter(b.characterId, (ch) => ({ character: { ...ch, conditions: ch.conditions.filter((x) => !clear.includes(x)) }, text: '' }))
    }
    for (const ev of r.t.events) await log(ev.text, '', r.t.state.round)
  }

  async function previous() {
    const s2 = await update((x) => {
      const st = previousTurn(x.combatants, { round: x.round, activeId: x.activeId })
      return { encounter: { ...x, round: st.round, activeId: st.activeId }, result: st }
    })
    const who = s2 && enc.combatants.find((c) => c.id === s2.activeId)
    if (s2 && who) await log(`↩︎ ย้อนกลับไปตาของ ${who.name} (รอบที่ ${s2.round}) · ระยะเวลาเอฟเฟกต์ไม่ย้อนกลับ`, '', s2.round)
  }

  async function end() {
    await patch(() => ({ status: 'ended', activeId: null }))
    await clearPcConditions(enc.combatants)
    // Out of combat: everyone's Action / Bonus Action / Reaction is available again.
    for (const c of enc.combatants) {
      if (c.kind === 'pc' && c.characterId) await updateCharacter(c.characterId, (ch) => ({ character: { ...ch, turn: startOfTurn() }, text: '' }))
    }
    await log(`🏁 จบการต่อสู้ (${enc.round} รอบ)`)
  }

  async function remove(cid: string) {
    const c = enc.combatants.find((x) => x.id === cid)!
    const events = await update((x) => {
      let base = x
      let evs: string[] = []
      // Removing the active combatant: move the turn on first, so the order continues from its place.
      if (x.activeId === cid && x.status === 'active') {
        const t = nextTurn(x.combatants, { round: x.round, activeId: x.activeId })
        const onlyOne = t.state.activeId === cid
        base = onlyOne
          ? { ...x, activeId: null }
          : { ...x, combatants: t.combatants, round: t.state.round, activeId: t.state.activeId }
        evs = onlyOne ? [] : t.events.map((ev) => ev.text)
      }
      return { encounter: { ...base, combatants: base.combatants.filter((m) => m.id !== cid) }, result: evs }
    })
    await clearPcConditions([c])
    await log(`${c.name} ออกจากการต่อสู้`)
    for (const ev of events ?? []) await log(ev)
  }

  async function addCombatants(list: Combatant[]) {
    await patch((x) => ({ combatants: sortByInitiative([...x.combatants, ...list]) }))
    for (const c of list) await log(`➕ ${c.name} เข้าร่วมการต่อสู้`, c.characterId ?? '')
    setAdding(false)
  }

  async function removeFight() {
    if (enc.status !== 'ended') await clearPcConditions(enc.combatants)
    await deleteEncounter(enc.id)
    go('/fights')
  }

  const waiting = enc.combatants.filter((c) => c.initiative === null)
  const monstersWaiting = waiting.some((c) => c.kind === 'monster')
  const rounds = groupByRound(fightLog)

  return (
    <div className="space-y-4 pb-24">
      <a href="#/fights" className="text-sm text-stone-400">← การต่อสู้ทั้งหมด</a>
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-amber-400">{enc.name}</h1>
          <p className="text-stone-400">
            {enc.status === 'setup' && 'เตรียมการ: เพิ่มผู้ร่วมต่อสู้และทอย Initiative'}
            {enc.status === 'active' && <span className="text-lg font-bold text-stone-100">รอบที่ {enc.round}</span>}
            {enc.status === 'ended' && `จบแล้ว (${enc.round} รอบ)`}
          </p>
        </div>
        <Button onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : '+ เพิ่มผู้ร่วมต่อสู้'}</Button>
      </header>

      {adding && <AddCombatants encounter={enc} characters={characters} onAdd={addCombatants} />}

      <div className="gap-4 space-y-4 lg:grid lg:grid-cols-3 lg:space-y-0">
        <div className="space-y-2 lg:col-span-2">
          {enc.combatants.length === 0 && (
            <p className="rounded-xl bg-stone-800 p-6 text-center text-stone-400">ยังไม่มีใคร กด "+ เพิ่มผู้ร่วมต่อสู้"</p>
          )}
          {monstersWaiting && (
            <Button className="w-full" onClick={rollMonsters}>🎲 ทอย Initiative ให้มอนสเตอร์ทั้งหมด</Button>
          )}
          {enc.combatants.map((c) => (
            <CombatantRow
              key={c.id}
              c={c}
              character={c.characterId ? byId.get(c.characterId) : undefined}
              active={enc.activeId === c.id}
              open={openId === c.id}
              onToggle={() => setOpenId(openId === c.id ? null : c.id)}
              onInitiative={(total, how) => setInitiative(c.id, total, how)}
              onUpdate={(fn) => updateCombatant(c.id, fn)}
              onCharacter={(fn) => c.characterId && updatePc(c.characterId, fn)}
              onRemove={() => remove(c.id)}
            />
          ))}
        </div>

        <Section title="บันทึกการต่อสู้">
          {fightLog.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีเหตุการณ์</p>}
          <div className="max-h-[60vh] space-y-3 overflow-y-auto text-sm">
            {rounds.map(([round, entries]) => (
              <div key={round}>
                {round > 0 && <div className="mb-1 text-xs font-bold text-amber-400">รอบที่ {round}</div>}
                <ul className="space-y-0.5">
                  {entries.map((x) => <li key={x.id}>{x.text}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </div>

      {enc.status === 'ended' && (
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setConfirmDelete(!confirmDelete)}>🗑 ลบการต่อสู้นี้</Button>
          {confirmDelete && <Button variant="danger" className="flex-1" onClick={removeFight}>ยืนยันลบ</Button>}
        </div>
      )}

      {/* Turn controls stay at the bottom of the screen. */}
      {enc.status !== 'ended' && enc.combatants.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-stone-700 bg-stone-900/95 p-3">
          <div className="mx-auto flex max-w-5xl gap-2">
            {enc.status === 'setup' ? (
              <Button
                variant="primary"
                className={`flex-1 ${enc.combatants.every((c) => c.initiative === null) ? 'opacity-50' : ''}`}
                onClick={() => { if (enc.combatants.some((c) => c.initiative !== null)) start() }}
              >
                ⚔️ เริ่มการต่อสู้{waiting.length > 0 && ` (ยังไม่ทอย ${waiting.length})`}
              </Button>
            ) : (
              <>
                <Button className="px-3" onClick={previous}>◀</Button>
                <Button variant="primary" className="flex-1" onClick={next}>ถัดไป ▶</Button>
                <Button className="px-3" onClick={end}>🏁 จบ</Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/** Group log entries by round (entries before the fight are round 0). */
function groupByRound<T extends { round?: number }>(entries: T[]): [number, T[]][] {
  const groups = new Map<number, T[]>()
  for (const e of entries) {
    const r = e.round ?? 0
    groups.set(r, [...(groups.get(r) ?? []), e])
  }
  return [...groups.entries()]
}
