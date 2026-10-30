import { onBeforeUnmount, onMounted } from 'vue'

const editable = '.cm-editor, input, textarea, [contenteditable="true"]'

/** Text fields and selected text keep the platform menu: it holds copy, paste and spelling. */
export function keepsNativeMenu(target: EventTarget | null): boolean {
  const element = target instanceof Element ? target : null
  if (!element || element.closest('.xterm')) return false
  if (element.closest(editable)) return true
  const selection = window.getSelection()
  if (!selection?.rangeCount || selection.isCollapsed) return false
  return selection.getRangeAt(0).intersectsNode(element)
}

export function opensMenu(event: KeyboardEvent): boolean {
  return event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey)
}

/**
 * Every actionable element answers a right click with its own menu, so the webview menu
 * (Reload, Inspect) never shows. Shift+F10 or the menu key opens the focused element's menu.
 */
export function useContextMenus() {
  function onContextMenu(event: MouseEvent) {
    if (event.isTrusted && !keepsNativeMenu(event.target)) event.preventDefault()
  }

  function onKeydown(event: KeyboardEvent) {
    const target = document.activeElement
    if (!opensMenu(event) || !(target instanceof HTMLElement)) return
    if (target.closest(editable) && !target.closest('.xterm')) return
    event.preventDefault()
    event.stopPropagation()
    const box = target.getBoundingClientRect()
    target.dispatchEvent(
      new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
        button: 2,
        clientX: box.left + Math.min(box.width / 2, 24),
        clientY: box.top + Math.min(box.height, 32),
      }),
    )
  }

  onMounted(() => {
    window.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeydown, { capture: true })
  })
  onBeforeUnmount(() => {
    window.removeEventListener('contextmenu', onContextMenu)
    window.removeEventListener('keydown', onKeydown, { capture: true })
  })
}
