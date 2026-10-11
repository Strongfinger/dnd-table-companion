import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { createCharacter } from '../model/character'
import { deleteCharacter, saveCharacter } from './characters'
import { db } from './db'
import { addLog, clearLog, listLog } from './log'

beforeEach(async () => {
  await db.characters.clear()
  await db.log.clear()
})

describe('play log', () => {
  it('lists a character\'s entries newest first', async () => {
    await addLog('a', 'first')
    await new Promise((r) => setTimeout(r, 5))
    await addLog('a', 'second')
    await addLog('b', 'other character')
    expect((await listLog('a')).map((e) => e.text)).toEqual(['second', 'first'])
  })

  it('limits and clears', async () => {
    for (let i = 0; i < 5; i++) await addLog('a', `e${i}`)
    expect(await listLog('a', 3)).toHaveLength(3)
    await clearLog('a')
    expect(await listLog('a')).toEqual([])
  })

  it('deleting a character deletes its log', async () => {
    const c = await saveCharacter(createCharacter({ name: 'X' }))
    await addLog(c.id, 'hit')
    await deleteCharacter(c.id)
    expect(await listLog(c.id)).toEqual([])
  })
})
