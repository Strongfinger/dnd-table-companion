// Fake DM for testing sheet sync against a player in the browser.
// 1. node scripts/lobby-test/dm.cjs TESTQ2  2. In the app join TESTQ2 as a player and pick a character.
// It answers the first sheet with a newer copy (-2 HP) and a stale one (should be ignored), then prints actions.
const { join, sleep } = require('./fb.cjs')
const code = process.argv[2]
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
let sheet = null
;(async () => {
  const conn = await join(code, { deviceId: 'node-dm', name: 'สคริปต์ DM', role: 'dm', characterId: null, characterName: null }, async (e) => {
    if (e.kind === 'hello') {
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
      }
    } else if (e.kind === 'action') {
      log('ACTION', JSON.stringify(e.body))
    } else log('msg', e.kind)
  })
  log('DM in room', code)
  await sleep(90000)
  await conn.leave(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
