// Fake DM for testing sheet sync against a player in the browser.
// 1. node scripts/lobby-test/dm.cjs TESTQ2  2. In the app join TESTQ2 as a player and pick a character.
// It answers the first sheet with a newer copy (-2 HP) and a stale one (should be ignored), sends a fight
// where it's the player's turn, then a hidden creature's turn, and prints (and confirms) actions and edits.
const { join, sleep } = require('./fb.cjs')
const code = process.argv[2]
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
let sheet = null
;(async () => {
  const conn = await join(code, { deviceId: 'node-dm', name: 'สคริปต์ DM', role: 'dm', characterId: null, characterName: null }, async (e) => {
    if (e.kind === 'hello' && e.body.edit) {
      log('EDIT', e.body.character.name, 'notes:', JSON.stringify(e.body.character.notes.slice(0, 40)), 'id', e.id.slice(0, 8))
      await conn.send('ack', { ids: [e.id] })
    } else if (e.kind === 'hello') {
      const first = !sheet
      sheet = e.body.character
      log('HELLO', sheet.name, 'rev', sheet.rev, 'hp', sheet.hp.current)
      if (first) {
        // Pretend the DM dealt 2 damage: newer copy back to the player.
        const dmCopy = { ...sheet, hp: { ...sheet.hp, current: sheet.hp.current - 2 }, rev: sheet.rev + 1, updatedBy: 'node-dm' }
        await conn.send('state', { character: dmCopy }); log('sent state rev', dmCopy.rev, 'hp', dmCopy.hp.current)
        await sleep(1500)
        const stale = { ...sheet, hp: { ...sheet.hp, current: 1 }, rev: sheet.rev - 1 }
        await conn.send('state', { character: stale }); log('sent STALE state rev', stale.rev, 'hp 1 (should be ignored)')
        sheet = dmCopy
        // A fight where it's this player's turn; one monster is Bloodied.
        const view = { id: 'f1', name: 'ทดสอบ: ซุ่มโจมตี', status: 'active', round: 2, hiddenTurn: false, combatants: [
          { id: 'g1', name: 'Goblin 1', kind: 'monster', initiative: 15, active: false, effects: [{ name: 'Prone', rounds: null }], health: 'bloodied', pc: null },
          { id: 'p1', name: sheet.name, kind: 'pc', initiative: 12, active: true, effects: [], health: 'hurt', pc: { characterId: sheet.id, hp: sheet.hp } },
          { id: 'g2', name: 'Goblin 2', kind: 'monster', initiative: 8, active: false, effects: [], health: 'healthy', pc: null },
        ] }
        await sleep(1000)
        await conn.send('fight', { view }); log('sent fight: player\'s turn')
        await sleep(8000)
        await conn.send('fight', { view: { ...view, hiddenTurn: true, combatants: view.combatants.map((c) => ({ ...c, active: false })) } }); log('sent fight: hidden turn')
      }
    } else if (e.kind === 'roll') {
      log('ROLL', JSON.stringify(e.body), 'from device', e.fromName)
    } else if (e.kind === 'action') {
      log('ACTION', JSON.stringify(e.body), 'id', e.id.slice(0, 8))
      await conn.send('ack', { ids: [e.id] })
    } else log('msg', e.kind)
  })
  log('DM in room', code)
  await sleep(Number(process.argv[3] ?? 90) * 1000)
  await conn.leave(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
