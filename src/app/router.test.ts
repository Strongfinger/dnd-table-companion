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
    expect(parseRoute('#/c/abc')).toEqual({ name: 'sheet', id: 'abc' })
    expect(parseRoute('#/c/abc/edit')).toEqual({ name: 'edit', id: 'abc' })
  })
})
