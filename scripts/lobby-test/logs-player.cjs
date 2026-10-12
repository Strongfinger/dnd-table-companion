// Fake PLAYER (Node the Bard) for turn rules and log deletions. Start a DM room in the app with a running
// fight where Node the Bard is NOT the active combatant, then: node scripts/lobby-test/logs-player.cjs ROOMCODE [seconds]
// It tries an Action and a Bonus Action (not its turn: refused) and a Reaction (allowed), then prints every
// log change it gets: delete fight-log or character-log lines on the DM device and watch them arrive as "removed".
const { join, sleep } = require('./fb.cjs')
const code = process.argv[2]
const bardId = 'node-bard-0001'
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
;(async () => {
  const conn = await join(code, { deviceId: 'node-player-2', name: 'สคริปต์ผู้เล่น', role: 'player', characterId: bardId, characterName: 'Node the Bard' }, (e) => {
    if (e.kind === 'state' && e.body.character.id === bardId) log('STATE turn', JSON.stringify(e.body.character.turn))
    else if (e.kind === 'fight') log('FIGHT active=', e.body.view?.combatants.find((c) => c.active)?.name ?? '-')
    else if (e.kind === 'log') {
      const b = e.body
      log('LOG', b.encounterId ? 'fight' : 'character', `+${b.entries.length}`, b.removed?.length ? `removed ${b.removed.length}` : '', b.from !== undefined ? `full from ${b.from}` : '', b.entries.slice(-2).map((x) => x.text).join(' | '))
    }
  })
  await conn.send('hello', { character: { id: bardId, name: 'Node the Bard', className: 'Bard', level: 2, scores: { str: 8, dex: 14, con: 12, int: 10, wis: 13, cha: 16 }, hp: { max: 15, current: 15, temp: 0 }, rev: 0 } })
  await sleep(4000)
  for (const kind of ['action', 'bonusAction', 'reaction']) {
    await conn.send('action', { characterId: bardId, action: { type: 'setActionUsed', kind, used: true, detail: 'ทดสอบ' } })
    log('tried', kind)
    await sleep(2000)
  }
  log('now delete log lines on the DM device…')
  await sleep(Number(process.argv[3] ?? 60) * 1000)
  await conn.leave(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
