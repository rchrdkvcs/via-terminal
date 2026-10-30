import { describe, expect, it } from 'vitest'
import {
  appliesWhileEditing,
  bindings,
  comboOf,
  formatShortcut,
  keyLabels,
  match,
  refusal,
} from './shortcuts'

const press = (code: string, mods: Partial<KeyboardEvent> = {}, key = code) =>
  ({
    code,
    key,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    metaKey: false,
    ...mods,
  }) as KeyboardEvent

describe('shortcuts', () => {
  it('leaves shell line-editing keys to the terminal outside macOS', () => {
    for (const code of ['KeyW', 'KeyD', 'KeyL', 'KeyK', 'KeyT', 'KeyB']) {
      expect(match(press(code, { ctrlKey: true }), 'windows')).toBeNull()
    }
  })

  it('matches Ctrl+Shift combos independently of the keyboard layout', () => {
    expect(match(press('KeyT', { ctrlKey: true, shiftKey: true }, 'T'), 'windows')).toEqual({
      id: 'newTab',
    })
    expect(match(press('Digit3', { ctrlKey: true }, '"'), 'linux')).toEqual({
      id: 'space',
      digit: 3,
    })
    expect(match(press('Tab', { ctrlKey: true, shiftKey: true }, 'Tab'), 'windows')).toEqual({
      id: 'previousTab',
    })
  })

  it('uses Command on macOS', () => {
    expect(match(press('KeyT', { metaKey: true }, 't'), 'macos')).toEqual({ id: 'newTab' })
    expect(formatShortcut('vault', 'macos')).toBe('⌘⇧H')
    expect(formatShortcut('newTab', 'windows')).toBe('Ctrl Maj T')
    expect(keyLabels(['Alt', 'Shift', 'D'], 'windows')).toEqual(['Alt', 'Maj', 'D'])
  })

  it('never binds the same combo twice on a platform', () => {
    for (const platform of ['other', 'mac'] as const) {
      const all = bindings.map((binding) => binding[platform].join('+'))
      expect(new Set(all).size).toBe(all.length)
    }
  })

  it('leaves tab, terminal and clipboard actions to text fields and the document editor', () => {
    const retarget = match(press('KeyL', { metaKey: true }, 'l'), 'macos')!
    const sidebar = match(press('KeyS', { metaKey: true }, 's'), 'macos')!
    expect([retarget.id, sidebar.id].map(appliesWhileEditing)).toEqual([false, false])
    expect(appliesWhileEditing(match(press('KeyT', { metaKey: true }, 't'), 'macos')!.id)).toBe(
      true,
    )
  })

  it('follows the combinations the user chose instead of the defaults', () => {
    const overrides = { closeTab: ['Alt', 'Cmd', 'W'] }
    expect(match(press('KeyW', { metaKey: true }, 'w'), 'macos', overrides)).toBeNull()
    expect(match(press('KeyW', { metaKey: true, altKey: true }, '∑'), 'macos', overrides)).toEqual({
      id: 'closeTab',
    })
    expect(formatShortcut('closeTab', 'macos', overrides)).toBe('⌥⌘W')
  })

  it('never lets the space digits be overridden', () => {
    expect(
      match(press('Digit2', { metaKey: true }, '2'), 'macos', { space: ['Ctrl', 'J'] }),
    ).toEqual({ id: 'space', digit: 2 })
  })

  it('records a key press as a combination, ignoring lone modifiers', () => {
    expect(comboOf(press('ShiftLeft', { shiftKey: true }, 'Shift'))).toBeNull()
    expect(comboOf(press('KeyJ', { metaKey: true, shiftKey: true }, 'J'))).toEqual([
      'Shift',
      'Cmd',
      'J',
    ])
    expect(comboOf(press('BracketLeft', { ctrlKey: true }, '['))).toEqual(['Ctrl', '['])
  })

  it('refuses combinations that would type text, clash or belong to macOS', () => {
    expect(refusal(['J'], 'closeTab', 'macos')).toMatch(/modification/)
    expect(refusal(['Shift', 'J'], 'closeTab', 'macos')).toMatch(/majuscules/)
    expect(refusal(['Cmd', 'Q'], 'closeTab', 'macos')).toMatch(/macOS/)
    expect(refusal(['Cmd', 'T'], 'closeTab', 'macos')).toMatch(/Nouvel onglet/)
    expect(refusal(['Cmd', '4'], 'closeTab', 'macos')).toMatch(/Espace/)
    expect(refusal(['Cmd', 'T'], 'closeTab', 'macos', { newTab: ['Cmd', 'N'] })).toBeNull()
    expect(refusal(['F5'], 'closeTab', 'windows')).toBeNull()
  })
})
