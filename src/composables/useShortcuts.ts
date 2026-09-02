import { useEventListener } from '@vueuse/core'
import { useAppStore } from '@/stores/app'

/**
 * Window-level shortcuts.
 *
 * The terminal swallows most keystrokes on purpose, so only chords the shell
 * genuinely owns are intercepted here. Nothing fires while a dialog holds
 * focus, otherwise the shortcut would drive the workspace behind it.
 */
export function useShortcuts() {
  const store = useAppStore()

  function dialogOpen() {
    return store.paletteOpen || store.searchOpen
  }

  function handle(event: KeyboardEvent) {
    const control = event.ctrlKey || event.metaKey

    if (control && event.key.toLowerCase() === 'k') {
      event.preventDefault()
      store.paletteOpen = !store.paletteOpen
      return
    }

    if (dialogOpen()) return

    if (control && event.shiftKey && event.key.toLowerCase() === 'f') {
      event.preventDefault()
      store.searchOpen = true
      return
    }

    if (control && !event.shiftKey && event.key.toLowerCase() === 't') {
      event.preventDefault()
      void store.createTerminal()
      return
    }

    if (control && event.shiftKey && event.key.toLowerCase() === 'n') {
      event.preventDefault()
      void store.openWindow()
      return
    }

    if (event.key === 'Escape' && store.route === 'settings') {
      event.preventDefault()
      store.route = 'workspace'
      return
    }

    if (control && !event.shiftKey && event.key.toLowerCase() === 'w') {
      event.preventDefault()
      if (store.activeTabId) void store.closeTab(store.activeTabId)
      return
    }

    // Ctrl+B is owned by SidebarProvider, which keeps its own state in sync.

    if (control && event.shiftKey && event.key === '"') {
      event.preventDefault()
      void store.splitActivePane('horizontal')
      return
    }

    if (control && event.shiftKey && event.key === '%') {
      event.preventDefault()
      void store.splitActivePane('vertical')
      return
    }

    if (event.altKey && !control && /^[1-9]$/.test(event.key)) {
      const workspace = store.workspaces[Number(event.key) - 1]
      if (!workspace) return
      event.preventDefault()
      store.switchWorkspace(workspace.id)
    }
  }

  // Capture the chord before xterm consumes it and stops DOM propagation.
  useEventListener(window, 'keydown', handle, { capture: true })
}
