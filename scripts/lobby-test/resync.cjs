// Fake PLAYER checking the DM device's "applied once" guarantees (step 4.5).
// 1. Open a room as DM in the app (online mode), with Node the Bard known there (run player.cjs once).
// 2. node scripts/lobby-test/resync.cjs ROOMCODE
//    It sends one action twice with the same id, one action meant to be replayed after a DM reload
//    (reload the DM page after "SENT REPLAY ACTION"; the script sends it again 15 s later, which must
//    only be confirmed), and an edit with stale HP (the DM must keep its HP and take the notes).
const crypto = require('node:crypto')
const { join, sleep } = require('./fb.cjs')
const code = process.argv[2]
const bardId = 'node-bard-0001'
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
;(async () => {
  let latest = null
  const acks = []
  const conn = await join(code, { deviceId: 'node-player-2', name: 'สคริปต์ผู้เล่น', role: 'player', characterId: bardId, characterName: 'Node the Bard' }, (e) => {
    if (e.kind === 'state') { latest = e.body.character; log('STATE rev', latest.rev, 'hp', latest.hp.current, 'notes', JSON.stringify(latest.notes.slice(0, 30))) }
    if (e.kind === 'ack') { acks.push(...e.body.ids); log('ACK', e.body.ids.map((i) => i.slice(0, 8)).join()) }
  })
  // The same envelope twice: the DM device must apply it once and confirm it twice.
  const id = crypto.randomUUID()
  const raw = (kind, body, id2 = crypto.randomUUID()) => ({ v: 2, id: id2, kind, from: 'node-player-2', fromName: 'สคริปต์ผู้เล่น', at: Date.now(), body })
  await sleep(1500)
  const dup = raw('action', { characterId: bardId, action: { type: 'heal', amount: 1 } }, id)
  await conn.sendRaw(dup); await sleep(500); await conn.sendRaw(dup)
  log('sent heal 1 TWICE with id', id.slice(0, 8))
  await sleep(3000)
  const replay = raw('action', { characterId: bardId, action: { type: 'damage', amount: 1, critical: false } })
  await conn.sendRaw(replay)
  log('SENT REPLAY ACTION (damage 1): reload the DM page now')
  await sleep(15000)
  // After the reload the DM's in-memory duplicate check is empty: only its saved ids can stop this.
  await conn.sendRaw({ ...replay, at: Date.now() })
  log('sent the same damage message again (id', replay.id.slice(0, 8) + '): must be confirmed, not applied')
  await sleep(5000)
  if (latest) {
    const edit = { ...latest, notes: 'แก้จากสคริปต์ ' + new Date().toISOString().slice(11, 19), hp: { ...latest.hp, current: latest.hp.max } }
    await conn.sendRaw(raw('hello', { character: edit, edit: true }))
    log('sent EDIT with new notes and stale full HP', edit.hp.current)
  }
  await sleep(6000)
  log('acks received:', acks.length)
  await conn.leave(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
