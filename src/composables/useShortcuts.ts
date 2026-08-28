import { onBeforeUnmount, onMounted } from 'vue'
import { useAppStore } from '@/stores/app'

/**
 * Window-level shortcuts.
 *
 * The terminal swallows most keystrokes on purpose, so only chords the shell
 * genuinely owns are intercepted here. Nothing fires while the application is
 * locked or while a dialog holds focus, otherwise the lock screen would drive
 * the workspace behind it.
 */
export function useShortcuts() {
  const store = useAppStore()

  function dialogOpen() {
    return store.paletteOpen || store.settingsOpen || store.searchOpen
  }

  function handle(event: KeyboardEvent) {
    if (store.locked) return

    const control = event.ctrlKey || event.metaKey

    if (control && event.shiftKey && event.key.toLowerCase() === 'l') {
      event.preventDefault()
      void store.lock()
      return
    }

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

    if (control && !event.shiftKey && event.key.toLowerCase() === 'w') {
      event.preventDefault()
      if (store.activeTabId) void store.closeTab(store.activeTabId)
      return
    }

    if (control && event.key === 'b') {
      event.preventDefault()
      store.sidebarVisible = !store.sidebarVisible
      return
    }

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

  onMounted(() => window.addEventListener('keydown', handle))
  onBeforeUnmount(() => window.removeEventListener('keydown', handle))
}
