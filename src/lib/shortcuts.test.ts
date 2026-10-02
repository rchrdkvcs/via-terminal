import { describe, expect, it } from 'vitest'
import { bindings, formatShortcut, keyLabels, match } from './shortcuts'

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
})
