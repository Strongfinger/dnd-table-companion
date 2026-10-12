import { describe, expect, it } from 'vitest'
import { PACK_FORMAT, packRecordId, parseCampaignPack } from './campaignPack'

const pack = (extra: object = {}) => JSON.stringify({
  format: PACK_FORMAT,
  campaign: { id: 'doip', name: 'Dragon of Icespire Peak' },
  pages: [
    { id: 'npc-toblen', kind: 'npc', title: 'Toblen Stonehill', fields: { role: 'เจ้าของโรงแรม' }, body: 'อยู่ที่ [[Stonehill Inn]]' },
    {
      id: 'session-1', kind: 'session', title: 'Session 1', date: '2026-10-17',
      scenes: [{ title: 'Orcs!', readAloud: 'เสียงคำราม...', checklist: ['เจอ Orc', ''], fight: 'orcs' }],
    },
  ],
  fights: [{ id: 'orcs', name: 'Orcs ขากลับ', monsters: [{ name: 'Orc', count: 2, ac: 13, hp: 15, initBonus: 1, notes: 'Greataxe' }] }],
  ...extra,
})

function ok(text: string) {
  const r = parseCampaignPack(text, 1000)
  if (!r.ok) throw new Error(r.error)
  return r
}

describe('parseCampaignPack', () => {
  it('builds pages, a session plan and a fight with stable ids', () => {
    const { pack: p, warnings } = ok(pack())
    expect(warnings).toEqual([])
    expect(p.campaign).toEqual({ id: 'doip', name: 'Dragon of Icespire Peak' })
    const [toblen, session] = p.notes
    expect(toblen).toMatchObject({ id: 'doip-npc-toblen', kind: 'npc', campaignId: 'doip', fields: { role: 'เจ้าของโรงแรม' } })
    expect(session.sessionDate).toBe('2026-10-17')
    expect(session.scenes[0].checklist.map((c) => c.text)).toEqual(['เจอ Orc'])
    expect(session.scenes[0].fightId).toBe(packRecordId('doip', 'orcs'))
    const fight = p.encounters[0]
    expect(fight).toMatchObject({ id: 'doip-orcs', campaignId: 'doip', status: 'setup' })
    expect(fight.combatants.map((c) => [c.name, c.ac, c.hp.max, c.initBonus, c.notes])).toEqual([
      ['Orc 1', 13, 15, 1, 'Greataxe'], ['Orc 2', 13, 15, 1, 'Greataxe'],
    ])
  })

  it('gives the same ids on a second import (so it updates instead of copying)', () => {
    const a = ok(pack()).pack
    const b = ok(pack()).pack
    expect(b.notes.map((n) => n.id)).toEqual(a.notes.map((n) => n.id))
    expect(b.encounters.map((e) => e.id)).toEqual(a.encounters.map((e) => e.id))
  })

  it('rejects other files and bad campaign ids', () => {
    expect(parseCampaignPack('not json').ok).toBe(false)
    expect(parseCampaignPack(JSON.stringify({ format: 'other' })).ok).toBe(false)
    expect(parseCampaignPack(pack({ campaign: { id: 'Bad Id!', name: 'x' } })).ok).toBe(false)
  })

  it('skips bad or repeated ids and warns about missing fights', () => {
    const r = ok(pack({
      pages: [
        { id: 'a', kind: 'place', title: 'A' }, { id: 'a', kind: 'place', title: 'A again' }, { id: '../x', title: 'X' },
        { id: 's', kind: 'weird', title: 'S', scenes: [{ title: 'Fight', fight: 'nope' }] },
      ],
    }))
    expect(r.pack.notes.map((n) => [n.title, n.kind])).toEqual([['A', 'place'], ['S', 'session']])
    expect(r.pack.notes[1].scenes[0].fightId).toBeNull()
    expect(r.warnings).toHaveLength(3)
  })

  it('clamps monster numbers and keeps hidden monsters hidden', () => {
    const r = ok(pack({ fights: [{ id: 'f', name: 'F', monsters: [{ name: 'Mimic', count: 99, ac: 12, hp: 99999, hidden: true }] }] }))
    const cs = r.pack.encounters[0].combatants
    expect(cs).toHaveLength(20)
    expect(cs[0].hp.max).toBe(999)
    expect(cs[0].hidden).toBe(true)
  })
})
