// Fake PLAYER for testing sheet sync against the DM in the browser.
// 1. Open a room as DM in the app (online mode).  2. node scripts/lobby-test/player.cjs ROOMCODE
// It sends a sheet, two actions, one forbidden action and a roll (add --flood for 60 pings);
// it prints every 'state', 'fight' and 'roll' it gets. Optional 2nd argument: seconds to stay (default 40).
const { join, sleep } = require('./fb.cjs')
const code = process.argv[2]
const bard = { id: 'node-bard-0001', name: 'Node the Bard', className: 'Bard', level: 2, scores: { str: 8, dex: 14, con: 12, int: 10, wis: 13, cha: 16 }, hp: { max: 15, current: 15, temp: 0 }, rev: 5, updatedBy: 'node-player-2' }
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
;(async () => {
  const states = []
  const conn = await join(code, { deviceId: 'node-player-2', name: 'สคริปต์ผู้เล่น', role: 'player', characterId: bard.id, characterName: bard.name }, (e) => {
    if (e.kind === 'state') { states.push(e.body.character); log('STATE', e.body.character.name, 'rev', e.body.character.rev, 'hp', e.body.character.hp.current, 'cond', e.body.character.conditions.join()) }
    else if (e.kind === 'fight') {
      const v = e.body.view
      log('FIGHT', v ? `${v.name} round ${v.round} hiddenTurn=${v.hiddenTurn} :: ` + v.combatants.map((c) => `${c.active ? '▶' : ''}${c.name}[${c.pc ? `HP ${c.pc.hp.current}/${c.pc.hp.max}` : c.health}${c.hp ? ' LEAK hp' : ''}${c.ac ? ' LEAK ac' : ''}]`).join(' ') : 'none')
    } else if (e.kind === 'roll') log('ROLL', e.body.by, e.body.expression, '=', e.body.total)
    else log('msg', e.kind)
  })
  await conn.send('hello', { character: bard }); log('sent hello rev 5')
  await sleep(3000)
  await conn.send('action', { characterId: bard.id, action: { type: 'damage', amount: 3, critical: false } }); log('sent action damage 3')
  await sleep(2000)
  await conn.send('action', { characterId: 'someone-else', action: { type: 'damage', amount: 99, critical: false } }); log('sent action for another character (should be ignored)')
  await conn.send('action', { characterId: bard.id, action: { type: 'setCondition', condition: 'Prone', on: true } }); log('sent Prone')
  await sleep(2000)
  // A shared roll, claiming a fake name: the room must name it from the member list instead.
  await conn.send('roll', { type: 'roll', by: 'Fake Name', expression: '1d20+5', mode: 'advantage', critical: false, total: 25, faces: [[20, 7]], natural: 20 }); log('sent roll 1d20+5 = 25 (nat 20)')
  // A flood: the DM device should drop what's over its limit (see its console).
  if (process.argv.includes('--flood')) { for (let i = 0; i < 60; i++) conn.send('ping', null); log('sent 60 pings') }
  await sleep(Number(process.argv[3] ?? 40) * 1000)
  await conn.leave(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
