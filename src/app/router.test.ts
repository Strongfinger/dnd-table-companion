import { describe, expect, it } from 'vitest'
import { parseRoute } from './router'

describe('parseRoute', () => {
  it('defaults to the list', () => {
    expect(parseRoute('')).toEqual({ name: 'list' })
    expect(parseRoute('#/')).toEqual({ name: 'list' })
    expect(parseRoute('#/nonsense')).toEqual({ name: 'list' })
  })

  it('parses new, sheet and edit', () => {
    expect(parseRoute('#/new')).toEqual({ name: 'new' })
    expect(parseRoute('#/import')).toEqual({ name: 'import' })
    expect(parseRoute('#/fights')).toEqual({ name: 'fights' })
    expect(parseRoute('#/about')).toEqual({ name: 'about' })
    expect(parseRoute('#/party')).toEqual({ name: 'party' })
    expect(parseRoute('#/lab')).toEqual({ name: 'lab' })
    expect(parseRoute('#/lobby')).toEqual({ name: 'lobby', code: null })
    expect(parseRoute('#/dm')).toEqual({ name: 'dm' })
    expect(parseRoute('#/lookup')).toEqual({ name: 'lookup', tab: null })
    expect(parseRoute('#/lookup/rules')).toEqual({ name: 'lookup', tab: 'rules' })
    expect(parseRoute('#/lookup/monster/goblin-warrior')).toEqual({ name: 'monster', id: 'goblin-warrior' })
    expect(parseRoute('#/lookup/spells')).toEqual({ name: 'lookup', tab: 'spells' })
    expect(parseRoute('#/lookup/spell/fireball')).toEqual({ name: 'spell', id: 'fireball' })
    expect(parseRoute('#/dm/import')).toEqual({ name: 'packImport' })
    expect(parseRoute('#/dm/note/n1')).toEqual({ name: 'note', id: 'n1' })
    expect(parseRoute('#/lobby/K7QX4M')).toEqual({ name: 'lobby', code: 'K7QX4M' })
    expect(parseRoute('#/fight/x1')).toEqual({ name: 'fight', id: 'x1' })
    expect(parseRoute('#/c/abc')).toEqual({ name: 'sheet', id: 'abc' })
    expect(parseRoute('#/c/abc/edit')).toEqual({ name: 'edit', id: 'abc' })
  })
})

describe('backup route', () => {
  it('opens the backup page', () => {
    expect(parseRoute('#/backup')).toEqual({ name: 'backup' })
  })
})
