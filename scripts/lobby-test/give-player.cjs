// Fake PLAYER for testing party give with accept against the DM in the browser (needs .env.local, Firebase mode).
// 1. Open a room as DM (online) with a real character played by someone in the room.  2. Run:
//    node scripts/lobby-test/give-player.cjs ROOMCODE offer RECEIVER_CHARACTER_ID   (gives 1 Rope + 5 GP offers to them)
//    node scripts/lobby-test/give-player.cjs ROOMCODE accept                          (accepts every offer made to this fake player)
//    node scripts/lobby-test/give-player.cjs ROOMCODE decline                         (declines them)
// The fake player is "Node the Rogue" with a Rope and 20 GP. Offers made to it show up in the log; run it with
// `offer` twice to see that the same offer message sent again (--twice) is only listed once.
const { join, sleep } = require('./fb.cjs')
const [code, mode, receiver] = process.argv.slice(2)
const rogue = { id: 'node-rogue-0001', name: 'Node the Rogue', className: 'Rogue', level: 2, scores: { str: 8, dex: 16, con: 12, int: 10, wis: 13, cha: 12 }, hp: { max: 15, current: 15, temp: 0 }, rev: 5, updatedBy: 'node-player-3', inventory: [{ id: 'rope-1', name: 'Rope', qty: 1 }], coins: { cp: 0, sp: 0, ep: 0, gp: 20, pp: 0 } }
const log = (...a) => console.log(new Date().toISOString().slice(17, 23), ...a)
;(async () => {
  let offers = []
  const conn = await join(code, { deviceId: 'node-player-3', name: 'สคริปต์ผู้เล่น (give)', role: 'player', characterId: rogue.id, characterName: rogue.name }, (e) => {
    if (e.kind === 'giveOffers') { offers = e.body.offers; log('OFFERS', offers.map((o) => `${o.fromName}->${o.toName} ${o.gift.name ?? o.gift.amount + ' ' + o.gift.coin} [${o.status}${o.reason ? ': ' + o.reason : ''}]`).join(' | ') || '(none)') }
    else if (e.kind === 'ack') log('ack')
  })
  await conn.send('hello', { character: rogue }); log('sent hello')
  await sleep(4000)
  if (mode === 'offer' && receiver) {
    const msg = { id: crypto.randomUUID(), kind: 'giveOffer', from: 'node-player-3', fromName: 'สคริปต์ผู้เล่น (give)', at: Date.now(), v: 2, body: { fromId: rogue.id, toId: receiver, itemId: 'rope-1', qty: 1 } }
    await conn.sendRaw(msg); log('sent offer: Rope')
    if (process.argv.includes('--twice')) { await conn.sendRaw(msg); log('sent the same offer again (must be listed once)') }
    await conn.send('giveOffer', { fromId: rogue.id, toId: receiver, coin: 'gp', amount: 5 }); log('sent offer: 5 GP')
  } else if (mode === 'accept' || mode === 'decline') {
    for (const o of offers.filter((x) => x.toId === rogue.id && x.status === 'open')) {
      await conn.send(mode === 'accept' ? 'giveAccept' : 'giveDecline', { offerId: o.id }); log(mode, o.id)
      if (mode === 'accept') await conn.send('giveAccept', { offerId: o.id }) // accept sent twice: moves once
    }
  }
  await sleep(Number(process.argv.find((a) => /^\d+$/.test(a) && a !== code) ?? 15) * 1000)
  await conn.leave(); process.exit(0)
})().catch((e) => { console.error(e); process.exit(1) })
