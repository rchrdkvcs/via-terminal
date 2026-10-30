import { afterEach, describe, expect, it } from 'vitest'
import { keepsNativeMenu, opensMenu } from './useContextMenus'

afterEach(() => {
  document.body.innerHTML = ''
  window.getSelection()?.removeAllRanges()
})

describe('keepsNativeMenu', () => {
  it('keeps the platform menu in text fields but not in the terminal', () => {
    document.body.innerHTML =
      '<input id="field"><div class="xterm"><textarea id="term"></textarea></div><div id="row">Row</div>'
    expect(keepsNativeMenu(document.getElementById('field'))).toBe(true)
    expect(keepsNativeMenu(document.getElementById('term'))).toBe(false)
    expect(keepsNativeMenu(document.getElementById('row'))).toBe(false)
  })
  it('keeps it on selected text', () => {
    document.body.innerHTML = '<p id="text">fingerprint</p>'
    const text = document.getElementById('text')!
    window.getSelection()!.selectAllChildren(text)
    expect(keepsNativeMenu(text)).toBe(true)
  })
})

describe('opensMenu', () => {
  it('answers Shift+F10 and the menu key only', () => {
    expect(opensMenu(new KeyboardEvent('keydown', { key: 'F10', shiftKey: true }))).toBe(true)
    expect(opensMenu(new KeyboardEvent('keydown', { key: 'ContextMenu' }))).toBe(true)
    expect(opensMenu(new KeyboardEvent('keydown', { key: 'F10' }))).toBe(false)
  })
})
