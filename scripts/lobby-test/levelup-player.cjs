// Fake PLAYER for testing the level-up permission (src/model/levelLock.ts) against the DM in the browser.
// 1. Open a room as DM in the app (online mode).  2. node scripts/lobby-test/levelup-player.cjs ROOMCODE
// It sends a level 2 sheet (the DM's copy comes back locked), tries level 3 without permission (refused:
// the DM's copy comes back at level 2), then waits up to 90 s for the DM to press "⬆️ ให้เลเวลอัป" and sends
// level 3 (taken; the grant is used up). It prints every 'state' it gets.
const { join, sleep } = require('./fb.cjs')
const code = process.argv[2]
const base = { id: 'node-lvl-0001', name: 'Node the Fighter', className: 'Fighter', level: 2, scores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 10 }, hp: { max: 20, current: 20, temp: 0 }, rev: 5, updatedBy: 'node-player-3' }
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
;(async () => {
  let last = null
  const conn = await join(code, { deviceId: 'node-player-3', name: 'สคริปต์เลเวล', role: 'player', characterId: base.id, characterName: base.name }, (e) => {
    if (e.kind === 'state') { last = e.body.character; log('STATE level', last.level, 'lock', JSON.stringify(last.levelLock), 'rev', last.rev) }
  })
  await conn.send('hello', { character: base }); log('sent hello: level 2')
  await sleep(4000)
  const cheat = { ...(last ?? base), level: 3, levelLock: { granted: 1 }, rev: (last?.rev ?? 5) + 1 }
  await conn.send('hello', { character: cheat, edit: true }); log('sent edit: level 3 without permission (claims a grant)')
  await sleep(4000)
  log('now press "⬆️ ให้เลเวลอัป" for Node the Fighter in the room screen…')
  for (let i = 0; i < 90 && !(last?.levelLock?.granted > 0); i++) await sleep(1000)
  if (!(last?.levelLock?.granted > 0)) { log('no grant came'); process.exit(1) }
  const up = { ...last, level: 3, levelLock: { granted: 0 }, hp: { ...last.hp, max: last.hp.max + 8 }, rev: last.rev + 1 }
  await conn.send('hello', { character: up, edit: true }); log('sent edit: level 3 with permission')
  await sleep(5000)
  log('RESULT level', last?.level, 'lock', JSON.stringify(last?.levelLock))
  process.exit(0)
})()
