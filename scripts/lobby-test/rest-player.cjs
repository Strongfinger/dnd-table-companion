// Fake PLAYER (Node the Bard) for the short-rest period. Open a DM room in the app, then run:
//   node scripts/lobby-test/rest-player.cjs ROOMCODE
// It rolls a Hit Die right away (no rest: refused), again when the DM starts the short rest (healed),
// and again after the DM ends it (refused). Start and end the rest from the DM's room screen.
const { join, sleep } = require('./fb.cjs')
const code = process.argv[2]
const bardId = 'node-bard-0001'
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
;(async () => {
  let resting = null
  const conn = await join(code, { deviceId: 'node-player-2', name: 'สคริปต์ผู้เล่น', role: 'player', characterId: bardId, characterName: 'Node the Bard' }, (e) => {
    if (e.kind === 'state' && e.body.character.id === bardId) { const c = e.body.character; log('STATE hp', c.hp.current, '/', c.hp.max, 'hit dice spent', c.hitDiceSpent) }
    else if (e.kind === 'rest') { resting = e.body.since; log('REST', resting ? 'started' : 'ended') }
  })
  const hitDie = (label) => { log('roll Hit Die (' + label + ')'); return conn.send('action', { characterId: bardId, action: { type: 'spendHitDie', roll: 6, manual: true } }) }
  await conn.send('hello', { character: { id: bardId, name: 'Node the Bard', className: 'Bard', level: 2, scores: { str: 8, dex: 14, con: 12, int: 10, wis: 13, cha: 16 }, hp: { max: 15, current: 15, temp: 0 }, rev: 0 } })
  await sleep(4000)
  await hitDie('no rest: must be refused')
  log('waiting for the DM to start the short rest…')
  while (!resting) await sleep(500)
  await hitDie('during the rest: heals')
  log('waiting for the DM to end the short rest…')
  while (resting) await sleep(500)
  await sleep(1000)
  await hitDie('after the rest: must be refused')
  await sleep(3000)
  await conn.leave(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
