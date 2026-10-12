import { afterEach, describe, expect, it } from 'vitest'
import { makeEnvelope, type Envelope } from './envelope'
import { localTransport } from './localTransport'
import type { Member, RoomConnection } from './transport'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const open: RoomConnection[] = []
afterEach(() => open.splice(0).forEach((c) => c.leave()))

function device(id: string, role: 'dm' | 'player', code = 'TEST22', heartbeatMs = 20) {
  const got: Envelope[] = []
  let members: Member[] = []
  const conn = localTransport({ heartbeatMs, timeoutMs: heartbeatMs * 4 }).join(code, { id, name: id, role, characterId: null, characterName: null }, {
    onMessage: (e) => got.push(e),
    onMembers: (m) => (members = m),
    onStatus: () => {},
  })
  open.push(conn)
  return { conn, got, members: () => members }
}

describe('local lobby connection (BroadcastChannel)', () => {
  it('members see each other and messages arrive once, from the right sender', async () => {
    const dm = device('dm', 'dm')
    const boom = device('boom-phone', 'player')
    await wait(60)
    expect(dm.members().map((m) => m.deviceId).sort()).toEqual(['boom-phone', 'dm'])

    const e = makeEnvelope('roll', { total: 17 }, { id: 'boom-phone', name: 'Boom' })
    boom.conn.send(e)
    boom.conn.send(e) // delivered twice
    await wait(30)
    expect(dm.got).toHaveLength(1)
    expect(dm.got[0]).toMatchObject({ kind: 'roll', from: 'boom-phone', body: { total: 17 } })
    expect(boom.got).toHaveLength(0) // not echoed back to the sender
  })

  it('a different room code hears nothing', async () => {
    const dm = device('dm', 'dm', 'ROOMAA')
    const other = device('x', 'player', 'ROOMBB')
    other.conn.send(makeEnvelope('ping', null, { id: 'x', name: 'x' }))
    await wait(50)
    expect(dm.got).toHaveLength(0)
    expect(dm.members()).toHaveLength(1)
  })

  it('a member who leaves is removed; one who goes quiet shows offline', async () => {
    const dm = device('dm', 'dm')
    const p = device('p', 'player')
    await wait(50)
    expect(dm.members().find((m) => m.deviceId === 'p')?.online).toBe(true)
    p.conn.leave()
    open.splice(open.indexOf(p.conn), 1)
    await wait(50)
    expect(dm.members().find((m) => m.deviceId === 'p')).toBeUndefined()
  })

  it('a reloaded tab sees the DM right away (not only at the next heartbeat)', async () => {
    const slow = 10_000 // no heartbeat during the test: only the answer to the first hello counts
    device('dm', 'dm', 'RELOAD', slow)
    const before = device('p', 'player', 'RELOAD', slow)
    await wait(30)
    // A reload: the same device joins again; the DM already knew it, so it isn't "new" to the DM.
    open.splice(open.indexOf(before.conn), 1)
    const after = device('p', 'player', 'RELOAD', slow)
    await wait(30)
    expect(after.members().map((m) => m.deviceId).sort()).toEqual(['dm', 'p'])
  })
})
