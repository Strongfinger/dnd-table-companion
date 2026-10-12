// Fake PLAYER (Node the Bard) checking the DM device's permissions. Start a DM room in the app with a
// running fight that includes Node the Bard, then: node scripts/lobby-test/permissions-player.cjs ROOMCODE
// It spends an Action, then tries give-backs a changed app could send (must be refused: the DM sends
// its copy back), ends its turn when it isn't its turn (ignored) and when it is (the turn moves on),
// and prints the fight list, the log lines players get, and the campaign.
const { join, sleep } = require('./fb.cjs')
const code = process.argv[2]
const bardId = 'node-bard-0001'
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
;(async () => {
  let view = null
  let sheet = null
  const conn = await join(code, { deviceId: 'node-player-2', name: 'สคริปต์ผู้เล่น', role: 'player', characterId: bardId, characterName: 'Node the Bard' }, (e) => {
    if (e.kind === 'state' && e.body.character.id === bardId) { sheet = e.body.character; log('STATE rev', sheet.rev, 'turn', JSON.stringify(sheet.turn), 'hp', sheet.hp.current) }
    else if (e.kind === 'fight') { view = e.body.view; log('FIGHT', view ? `round ${view.round} active=${view.combatants.find((c) => c.active)?.name ?? (view.hiddenTurn ? 'hidden' : '-')}` : 'none') }
    else if (e.kind === 'fights') log('FIGHTS', e.body.fights.map((f) => `${f.name} [${f.status} r${f.round}]`).join(' · '))
    else if (e.kind === 'log') log('LOG', e.body.entries.map((x) => `r${x.round} ${x.text}`).join(' | '))
    else if (e.kind === 'campaign') log('CAMPAIGN', e.body.name)
    else if (e.kind === 'ack') log('ACK')
  })
  await conn.send('hello', { character: { id: bardId, name: 'Node the Bard', className: 'Bard', level: 2, scores: { str: 8, dex: 14, con: 12, int: 10, wis: 13, cha: 16 }, hp: { max: 15, current: 15, temp: 0 }, rev: 0 } })
  await sleep(4000)
  await conn.send('action', { characterId: bardId, action: { type: 'setActionUsed', kind: 'bonusAction', used: true, detail: 'Bardic Inspiration' } })
  log('spent Bonus Action')
  await sleep(2500)
  for (const action of [{ type: 'setActionUsed', kind: 'bonusAction', used: false }, { type: 'resetTurn' }, { type: 'longRest' }]) {
    await conn.send('action', { characterId: bardId, action })
    log('tried give-back', action.type)
    await sleep(2000)
  }
  // End turn: first pretend it's someone else's turn (must be ignored), then the real one.
  const active = view?.combatants.find((c) => c.active)
  const other = view?.combatants.find((c) => !c.active)
  if (other) { await conn.send('endTurn', { encounterId: view.id, round: view.round, combatantId: other.id }); log('endTurn for', other.name, '(not mine: ignored)') }
  await sleep(2500)
  if (active?.pc?.characterId === bardId) { await conn.send('endTurn', { encounterId: view.id, round: view.round, combatantId: active.id }); log('endTurn for my turn') }
  else log('it is not my turn:', active?.name)
  await sleep(5000)
  await conn.leave(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
