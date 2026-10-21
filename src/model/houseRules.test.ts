import { describe, expect, it } from 'vitest'
import { mergeRules, ownRules, parseHouseRules, rulesToShare, searchRules } from './houseRules'
import { createNote, type Note } from './note'

const rule = (title: string, fields: Record<string, string> = {}, campaignId: string | null = 'doip', body = ''): Note =>
  ({ ...createNote(campaignId, 0, 'rule', title), fields: { status: 'active', ...fields }, body })

describe('house rules for players', () => {
  const burning = rule('Burning', { type: 'condition', effect: '1d4 Fire', trigger: 'โดน [[Flaming Weapon]]' }, 'doip', 'ดู [[Flaming Weapon]]')
  const flaming = rule('Flaming Weapon', { status: 'trial', effect: '+2 Fire' })
  const off = rule('Old rule', { status: 'off' })
  const other = rule('Other campaign', {}, 'lmop')
  const npc = { ...createNote('doip', 0, 'npc', 'Harbin'), fields: { role: 'Townmaster' } }

  it('shares only the campaign rules in use, sorted, with links as plain text', () => {
    const shared = rulesToShare([flaming, off, other, npc, burning], 'doip')
    expect(shared.map((r) => r.title)).toEqual(['Burning', 'Flaming Weapon'])
    expect(shared[0]).toMatchObject({ status: 'active', fields: { type: 'condition', effect: '1d4 Fire', trigger: 'โดน Flaming Weapon' }, body: 'ดู Flaming Weapon' })
    expect(shared[1].status).toBe('trial')
    expect(shared[0].fields).not.toHaveProperty('status')
  })

  it('skips untitled rules and keeps the message small', () => {
    expect(rulesToShare([rule('  ')], 'doip')).toEqual([])
    expect(rulesToShare([rule('No status', { status: '' })], 'doip').map((r) => r.status)).toEqual(['active'])
    const many = Array.from({ length: 60 }, (_, i) => rule(`Rule ${i}`, {}, 'doip', 'ก'.repeat(3000)))
    const shared = rulesToShare(many, 'doip')
    expect(shared.length).toBeGreaterThan(0)
    expect(JSON.stringify(shared).length).toBeLessThanOrEqual(20_000)
  })

  it('reads a room message back, refusing broken ones', () => {
    const msg = { campaignId: 'doip', rules: rulesToShare([burning, flaming], 'doip') }
    expect(parseHouseRules(JSON.parse(JSON.stringify(msg)))).toEqual(msg)
    expect(parseHouseRules({ campaignId: null, rules: [{ id: 'x', title: 'X', status: 'off', fields: { effect: 'e', secret: 's' } }] }))
      .toEqual({ campaignId: null, rules: [{ id: 'x', title: 'X', status: 'active', fields: { effect: 'e' }, body: '' }] })
    expect(parseHouseRules({ campaignId: 'doip', rules: [{ id: 'x', title: '' }] })).toBeNull()
    expect(parseHouseRules({ campaignId: 5, rules: [] })).toBeNull()
    expect(parseHouseRules(null)).toBeNull()
  })

  it('searches titles, fields and text; merges own and received rules', () => {
    const shared = rulesToShare([burning, flaming], 'doip')
    expect(searchRules(shared, 'fire burning').map((r) => r.title)).toEqual(['Burning'])
    expect(searchRules(shared, '+2').map((r) => r.title)).toEqual(['Flaming Weapon'])
    const own = ownRules([burning, other])
    expect(own.map((r) => r.title)).toEqual(['Burning', 'Other campaign'])
    expect(ownRules([burning, other], 'lmop').map((r) => r.title)).toEqual(['Other campaign'])
    expect(ownRules([burning, other], 'unknown').map((r) => r.title)).toEqual(['Burning', 'Other campaign'])
    expect(mergeRules(own, shared).map((r) => r.title)).toEqual(['Burning', 'Flaming Weapon', 'Other campaign'])
  })
})
