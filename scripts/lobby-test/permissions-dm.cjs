// Fake DM for the player-permission checks: join in the app as a player (pick a character) after starting it.
//   node scripts/lobby-test/permissions-dm.cjs TESTPQ [seconds]
// It sends the campaign, a fight list with a log, and a fight where it's the player's turn; it confirms
// actions and prints them (a give-back must never arrive), and prints 'endTurn' requests.
// --not-my-turn: start on the Goblin's turn (Action/Bonus Action locked on the phone); after 25 s it
// deletes a character-log line and makes it the player's turn.
const { join, sleep } = require('./fb.cjs')
const code = process.argv[2]
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
let sheet = null
;(async () => {
  const conn = await join(code, { deviceId: 'node-dm', name: 'สคริปต์ DM', role: 'dm', characterId: null, characterName: null }, async (e) => {
    if (e.kind === 'hello' && !e.body.edit && !sheet) {
      sheet = e.body.character
      log('HELLO', sheet.name, 'slots', JSON.stringify(sheet.spellSlots.filter((s) => s.max)), 'turn', JSON.stringify(sheet.turn))
      await conn.send('campaign', { id: 'camp-from-dm', name: 'แคมเปญของ DM (ทดสอบ)' })
      const fights = [
        { id: 'f-live', name: 'ทดสอบสิทธิ์: ถ้ำก็อบลิน', status: 'active', round: 2, updatedAt: Date.now() },
        { id: 'f-old', name: 'ทดสอบ: ศึกเก่า', status: 'ended', round: 4, updatedAt: Date.now() - 1e6 },
      ]
      await conn.send('fights', { fights })
      await conn.send('log', { encounterId: 'f-live', entries: [
        { id: 'l1', at: 1, round: 1, text: '⚔️ เริ่มการต่อสู้ — รอบที่ 1 —' },
        { id: 'l2', at: 2, round: 1, text: `ตาของ ${sheet.name}` },
        { id: 'l3', at: 3, round: 2, text: '— รอบที่ 2 —' },
      ] })
      const view = (mine) => ({ id: 'f-live', name: fights[0].name, status: 'active', round: 2, hiddenTurn: false, combatants: [
        { id: 'pc1', name: sheet.name, kind: 'pc', initiative: 15, active: mine, effects: [], health: 'healthy', pc: { characterId: sheet.id, hp: sheet.hp } },
        { id: 'g1', name: 'Goblin 1', kind: 'monster', initiative: 10, active: !mine, effects: [], health: 'bloodied', pc: null },
      ] })
      // The player's character log follows the DM's: two lines now, one deleted later.
      await conn.send('log', { characterId: sheet.id, entries: [
        { id: 'cl-1', at: Date.now() - 2000, round: 1, text: `${sheet.name} โดน 3 ดาเมจ (จาก DM)` },
        { id: 'cl-2', at: Date.now() - 1000, round: 1, text: `บรรทัดที่ DM จะลบ` },
      ] })
      const firstMine = !process.argv.includes('--not-my-turn')
      await conn.send('fight', { view: view(firstMine) })
      log('sent campaign, fights, log, character log, fight', firstMine ? "(player's turn)" : '(Goblin\'s turn)')
      if (!firstMine) {
        await sleep(25000)
        await conn.send('log', { characterId: sheet.id, entries: [], removed: ['cl-2'] })
        await conn.send('fight', { view: view(true) })
        log("deleted character-log line cl-2; now it's the player's turn")
      }
    } else if (e.kind === 'action') {
      log('ACTION', JSON.stringify(e.body.action))
      await conn.send('ack', { ids: [e.id] })
    } else if (e.kind === 'endTurn') {
      log('ENDTURN', JSON.stringify(e.body))
    } else if (e.kind !== 'roll') log('msg', e.kind)
  })
  log('DM in room', code)
  await sleep(Number(process.argv[3] ?? 120) * 1000)
  await conn.leave(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
