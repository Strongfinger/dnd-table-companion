import { describe, expect, it } from 'vitest'
import { hotkeyFor, type KeyPress } from './hotkeys'

const press = (code: string, over: Partial<KeyPress> = {}): KeyPress => ({
  code, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false,
  isComposing: false, repeat: false, typing: false, onControl: false, dialogOpen: false, ...over,
})

describe('hotkeyFor', () => {
  it('maps the sketch keys by physical key code', () => {
    expect(hotkeyFor(press('KeyN'))).toBe('next')
    expect(hotkeyFor(press('Space'))).toBe('next')
    expect(hotkeyFor(press('KeyP'))).toBe('previous')
    expect(hotkeyFor(press('KeyD'))).toBe('damage')
    expect(hotkeyFor(press('KeyZ'))).toBe('undo')
    expect(hotkeyFor(press('Slash'))).toBe('search')
    expect(hotkeyFor(press('Escape'))).toBe('escape')
    expect(hotkeyFor(press('Slash', { shiftKey: true }))).toBe('help')
  })

  it('works on the Thai layout: only the code matters, never the typed character', () => {
    // KeyboardEvent.key would be "ื" for the N key on a Thai keyboard; the code is still KeyN.
    expect(hotkeyFor(press('KeyN'))).toBe('next')
  })

  it('ignores unknown keys and shifted letters', () => {
    expect(hotkeyFor(press('KeyQ'))).toBeNull()
    expect(hotkeyFor(press('KeyN', { shiftKey: true }))).toBeNull()
    expect(hotkeyFor(press('Enter'))).toBeNull()
  })

  it('is ignored while typing', () => {
    for (const code of ['KeyN', 'Space', 'KeyP', 'KeyD', 'KeyZ', 'Slash', 'Escape']) expect(hotkeyFor(press(code, { typing: true }))).toBeNull()
  })

  it('is ignored with Ctrl, Meta or Alt held (Cmd+N, Ctrl+R… keep working)', () => {
    expect(hotkeyFor(press('KeyN', { ctrlKey: true }))).toBeNull()
    expect(hotkeyFor(press('KeyN', { metaKey: true }))).toBeNull()
    expect(hotkeyFor(press('KeyN', { altKey: true }))).toBeNull()
    expect(hotkeyFor(press('KeyZ', { metaKey: true }))).toBeNull()
  })

  it('is ignored during IME composition and for held-down keys', () => {
    expect(hotkeyFor(press('KeyN', { isComposing: true }))).toBeNull()
    expect(hotkeyFor(press('KeyN', { repeat: true }))).toBeNull()
  })

  it('is ignored while a dialog is open', () => {
    expect(hotkeyFor(press('KeyN', { dialogOpen: true }))).toBeNull()
    expect(hotkeyFor(press('Escape', { dialogOpen: true }))).toBeNull()
  })

  it('Space is ignored on a focused button, but N still works there', () => {
    expect(hotkeyFor(press('Space', { onControl: true }))).toBeNull()
    expect(hotkeyFor(press('KeyN', { onControl: true }))).toBe('next')
  })

  it('switched off: every character key is ignored, Esc still works', () => {
    for (const p of [press('KeyN'), press('Space'), press('KeyP'), press('KeyD'), press('KeyZ'), press('Slash'), press('Slash', { shiftKey: true })]) {
      expect(hotkeyFor(p, false)).toBeNull()
    }
    expect(hotkeyFor(press('Escape'), false)).toBe('escape')
  })
})
