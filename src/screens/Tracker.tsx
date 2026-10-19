// The DM's initiative tracker for one fight: order, turns, HP, effects and the fight log.
// Rules live in src/rules (turns, play) and src/model (encounter, actions); this file wires them up.
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { go } from '../app/router'
import { listCharacters } from '../db/characters'
import { deleteEncounter, getEncounter, updateEncounter } from '../db/encounters'
import { addLog, listEncounterLog } from '../db/log'
import { playAction } from '../db/play'
import { advanceTurn, makeCharacterFromCombatant } from '../db/turns'
import { isDead } from '../model/actions'
import type { CharacterAction } from '../model/characterActions'
import { conditionsToClear, MAX_FIGHT_NAME, renameEncounter, rollInitiative, type Combatant, type Encounter, type MonsterResult } from '../model/encounter'
import { nextTurn, previousTurn, sortByInitiative, startCombat, startOfTurn } from '../rules'
import { Button } from '../ui/kit'
import { playerView } from '../model/playerView'
import LogLine from '../ui/LogLine'
import AddCombatants from './AddCombatants'
import PlayerViewPanel from './PlayerViewPanel'
import CombatantRow from './CombatantRow'
import DmPanel from './DmPanel'


export default function Tracker({ id }: { id: string }) {
  const e = useLiveQuery(() => getEncounter(id).then((x) => x ?? null), [id])
  const characters = useLiveQuery(listCharacters) ?? []
  const fightLog = useLiveQuery(() => listEncounterLog(id), [id]) ?? []
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showPlayerView, setShowPlayerView] = useState(false)
  /** Why the last change was refused (e.g. giving back a slot spent in an earlier round). */
  const [notice, setNotice] = useState<string | null>(null)

  if (e === undefined) return null
  if (e === null) return <p className="text-center text-stone-400">ไม่พบการต่อสู้นี้</p>

  const enc = e
  const byId = new Map(characters.map((c) => [c.id, c]))
  /**
   * Write to the fight log (and to the PC's own sheet log when it's about a PC).
   * `forPlayers`: players in a live room may see the line (only when it holds no DM secrets).
   */
  const log = (text: string, characterId = '', round = enc.round, forPlayers = false) => addLog(characterId, text, { encounterId: enc.id, round }, forPlayers)
  /** Lines naming a combatant are shown to players only while that combatant is visible. */
  const visible = (c: Combatant | undefined) => !!c && !c.hidden

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

  /**
   * Apply a character action to a linked PC. From the DM's taps it's checked (give-backs only in the
   * round of the use) and logged; `byApp` is the tracker's own bookkeeping (new turn, fight over).
   */
  async function pcAction(characterId: string, action: CharacterAction, byApp = false) {
    const r = await playAction(characterId, action, byApp ? 'system' : 'dm')
    if (r.refused) setNotice(r.refused)
    else if (r.text && !byApp) await log(r.text, characterId)
  }

  /** Take tracker-applied conditions off PC sheets for these combatants (fight over / removed). */
  async function clearPcConditions(list: Combatant[]) {
    for (const c of list) {
      if (c.kind !== 'pc' || !c.characterId) continue
      for (const condition of conditionsToClear(c.effects, [])) await pcAction(c.characterId, { type: 'setCondition', condition, on: false }, true)
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
    await log('⚔️ เริ่มการต่อสู้ — รอบที่ 1 —', '', 1, true)
    const firstUp = first?.combatants.find((c) => c.id === first.activeId)
    if (first?.name) await log(`ตาของ ${first.name}`, '', 1, visible(firstUp))
  }

  /** Start of a creature's turn: Action, Bonus Action and Reaction come back. */
  async function refreshTurn(activeId: string | null, combatants: Combatant[]) {
    const who = combatants.find((c) => c.id === activeId)
    if (who?.kind === 'pc' && who.characterId) await pcAction(who.characterId, { type: 'resetTurn' }, true)
  }
  const freshMonster = (list: Combatant[], activeId: string | null) =>
    list.map((c) => (c.id === activeId && c.kind === 'monster' ? { ...c, turn: startOfTurn() } : c))

  /** Next turn (shared with players ending their own turn from a phone in a live room). */
  const next = () => advanceTurn(enc.id)

  async function previous() {
    const s2 = await update((x) => {
      const st = previousTurn(x.combatants, { round: x.round, activeId: x.activeId })
      return { encounter: { ...x, round: st.round, activeId: st.activeId }, result: st }
    })
    const who = s2 && enc.combatants.find((c) => c.id === s2.activeId)
    if (s2 && who) await log(`↩︎ ย้อนกลับไปตาของ ${who.name} (รอบที่ ${s2.round}) · ระยะเวลาเอฟเฟกต์ไม่ย้อนกลับ`, '', s2.round, visible(who))
  }

  async function end() {
    await patch(() => ({ status: 'ended', activeId: null }))
    await clearPcConditions(enc.combatants)
    // Out of combat: everyone's Action / Bonus Action / Reaction is available again.
    for (const c of enc.combatants) {
      if (c.kind === 'pc' && c.characterId) await pcAction(c.characterId, { type: 'resetTurn' }, true)
    }
    await log(`🏁 จบการต่อสู้ (${enc.round} รอบ)`, '', enc.round, true)
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
    await log(`${c.name} ออกจากการต่อสู้`, '', enc.round, visible(c))
    for (const ev of events ?? []) await log(ev)
  }

  async function addCombatants(list: Combatant[]) {
    await patch((x) => ({ combatants: sortByInitiative([...x.combatants, ...list]) }))
    for (const c of list) await log(`➕ ${c.name} เข้าร่วมการต่อสู้`, c.characterId ?? '', enc.round, visible(c))
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
          <FightTitle name={enc.name} onRename={(name) => patch((x) => renameEncounter(x, name))} />
          <p className="text-stone-400">
            {enc.status === 'setup' && 'เตรียมการ: เพิ่มผู้ร่วมต่อสู้และทอย Initiative'}
            {enc.status === 'active' && <span className="text-lg font-bold text-stone-100">รอบที่ {enc.round}</span>}
            {enc.status === 'ended' && `จบแล้ว (${enc.round} รอบ)`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowPlayerView(!showPlayerView)}>{showPlayerView ? 'ปิดมุมมองผู้เล่น' : '👁 มุมมองผู้เล่น'}</Button>
          <Button onClick={() => setAdding(!adding)}>{adding ? 'ปิด' : '+ เพิ่มผู้ร่วมต่อสู้'}</Button>
        </div>
      </header>

      {notice && (
        <p role="status" onClick={() => setNotice(null)} className="rounded-lg bg-amber-950 p-3 text-sm text-amber-200">⚠️ {notice}</p>
      )}

      {showPlayerView && <PlayerViewPanel view={playerView(enc, byId)} />}

      {adding && <AddCombatants encounter={enc} characters={characters} onAdd={addCombatants} />}

      {/* Laptop: combatants on the left, the DM panel (stat block, lookup, notes, log) on the right. */}
      <div className="gap-4 space-y-4 lg:grid lg:grid-cols-5 lg:items-start lg:space-y-0">
        <div className="space-y-2 lg:col-span-3">
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
              onPcAction={(action) => c.characterId && pcAction(c.characterId, action)}
              onRemove={() => remove(c.id)}
              onMakeCharacter={() => void makeCharacterFromCombatant(enc.id, c.id)}
            />
          ))}
        </div>

        <div className="lg:col-span-2">
          <DmPanel
            encounter={enc}
            log={
              <>
                {fightLog.length === 0 && <p className="text-sm text-stone-500">ยังไม่มีเหตุการณ์</p>}
                <div className="space-y-3 text-sm">
                  {rounds.map(([round, entries]) => (
                    <div key={round}>
                      {round > 0 && <div className="mb-1 text-xs font-bold text-amber-400">รอบที่ {round}</div>}
                      <ul className="space-y-0.5">
                        {entries.map((x) => <li key={x.id}><LogLine id={x.id}>{x.text}</LogLine></li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            }
          />
        </div>
      </div>

      {/* Delete at any time (an unwanted or test fight), not only after it ended. Asks first. */}
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => setConfirmDelete(!confirmDelete)}>{confirmDelete ? 'ไม่ลบ' : '🗑 ลบการต่อสู้นี้'}</Button>
          {confirmDelete && <Button variant="danger" className="flex-1" onClick={removeFight}>ยืนยันลบ</Button>}
        </div>
        {confirmDelete && (
          <p className="text-sm text-stone-400">
            ลบการต่อสู้และบันทึกการต่อสู้นี้ทั้งหมด (บันทึกในใบตัวละครยังอยู่, HP ไม่ถูกย้อนกลับ)
            {enc.status !== 'ended' && ' · การต่อสู้นี้ยังไม่จบ: Condition จากการต่อสู้นี้จะถูกเอาออกจากใบตัวละคร'}
          </p>
        )}
      </div>

      {/* Turn controls stay at the bottom of the screen. */}
      {enc.status !== 'ended' && enc.combatants.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-stone-700 bg-stone-900/95 p-3">
          <div className="mx-auto flex max-w-7xl gap-2">
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

/** The fight's name; ✏️ turns it into a box to rename it (Enter saves, Esc cancels). */
function FightTitle({ name, onRename }: { name: string; onRename: (name: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const save = () => {
    if (draft !== null && draft.trim()) onRename(draft)
    setDraft(null)
  }
  if (draft === null) {
    return (
      <h1 className="text-2xl font-bold text-amber-400">
        {name}{' '}
        <button type="button" onClick={() => setDraft(name)} className="align-middle text-base text-stone-400 hover:text-amber-300" aria-label="แก้ไขชื่อการต่อสู้" title="แก้ไขชื่อการต่อสู้">✏️</button>
      </h1>
    )
  }
  return (
    <form className="flex flex-wrap items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); save() }}>
      <input
        autoFocus
        aria-label="ชื่อการต่อสู้"
        value={draft}
        maxLength={MAX_FIGHT_NAME}
        onChange={(ev) => setDraft(ev.target.value)}
        onKeyDown={(ev) => { if (ev.key === 'Escape') setDraft(null) }}
        className="min-w-0 flex-1 rounded-lg border border-amber-400 bg-stone-900 px-3 py-1 text-xl font-bold text-amber-300 focus:outline-none"
      />
      <Button variant="primary" className="text-sm" onClick={save}>บันทึก</Button>
      <Button className="text-sm" onClick={() => setDraft(null)}>ยกเลิก</Button>
    </form>
  )
}
