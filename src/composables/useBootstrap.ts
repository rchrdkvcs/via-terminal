import { ref, watchEffect } from 'vue'
import { api, describeError, isNative } from '@/ipc/client'
import type { Bootstrap } from '@/ipc/types'
import { hueOf } from '@/domain/palette'
import { terminals } from '@/terminal/registry'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import { useWorkbench } from '@/stores/workbench'

const ENTER = String.fromCharCode(13)

/** What the browser preview (`vite dev` without Tauri) starts with. */
function previewBootstrap(): Bootstrap {
  const id = crypto.randomUUID()
  return {
    layout: {
      activeSpaceId: id,
      sidebar: { width: 264, visible: true },
      spaces: [
        { id, name: 'Personnel', icon: 'terminal', color: 'slate', defaultShell: null, pinned: [] },
      ],
    },
    settings: useSettings().settings,
    vault: useVault().view,
    shells: [{ path: 'pwsh.exe', name: 'PowerShell 7', args: [] }],
    systemShell: 'pwsh.exe',
    platform: 'windows',
  }
}

/**
 * Loads everything once, then keeps the window and the terminals in step
 * with settings and the active space.
 */
export function useBootstrap() {
  const ready = ref(false)
  const failure = ref<string | null>(null)
  const settings = useSettings()
  const spaces = useSpaces()
  const sessions = useSessions()
  const vault = useVault()
  const workbench = useWorkbench()

  terminals.configure({
    onData: (tabId, data) => {
      // Enter in an ended or disconnected pane reconnects it, as the bar says.
      const state = sessions.runtime(tabId).state
      if (data === ENTER && ['exited', 'disconnected', 'failed'].includes(state)) {
        workbench.reconnect(tabId)
      } else sessions.write(tabId, data)
    },
    onResize: (tabId, cols, rows) => sessions.resize(tabId, cols, rows),
    onTitle: (tabId, title) => sessions.setAutoTitle(tabId, title),
    onSelection: (_tabId, text) => {
      if (settings.settings.copyOnSelect && text) void navigator.clipboard.writeText(text)
    },
  })

  async function load() {
    try {
      const bootstrap = isNative() ? await api.bootstrap() : previewBootstrap()
      settings.hydrate(bootstrap)
      vault.hydrate(bootstrap.vault)
      spaces.hydrate(bootstrap.layout)
      ready.value = true
    } catch (cause) {
      failure.value = describeError(cause)
    }
  }

  watchEffect(() => {
    const hue = hueOf(spaces.active?.color ?? 'slate')
    const root = document.documentElement
    root.classList.toggle('dark', settings.appearance === 'dark')
    root.style.setProperty('--space-hue', String(hue))
    const { fontFamily, fontSize, lineHeight, cursorStyle, cursorBlink, scrollback } =
      settings.settings
    terminals.setPresentation({
      fontFamily,
      fontSize,
      lineHeight,
      cursorStyle,
      cursorBlink,
      scrollback,
      appearance: settings.appearance,
      hue,
    })
  })

  void load()
  // Dev-only handle for the CDP checks in `.ai/`.
  if (import.meta.env.DEV) Object.assign(window, { __via: { spaces, sessions, workbench } })
  return { ready, failure }
}
