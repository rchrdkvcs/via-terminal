import { ref, watchEffect } from 'vue'
import { api, describeError, isNative } from '@/ipc/client'
import type { Bootstrap } from '@/ipc/types'
import { terminals } from '@/terminal/registry'
import { useCwdMemory } from './useCwdMemory'
import { adoptTabNames } from './useNameAdoption'
import { dragging, hint } from './useRowDnd'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import { useWorkbench } from '@/stores/workbench'
import { useUpdates } from '@/stores/updates'

const ENTER = String.fromCharCode(13)

function previewBootstrap(): Bootstrap {
  const id = crypto.randomUUID()
  return {
    layout: {
      activeSpaceId: id,
      sidebar: { width: 264, visible: true },
      spaces: [{ id, name: 'Personnel', icon: 'terminal', defaultShell: null, pinned: [] }],
    },
    settings: useSettings().settings,
    vault: useVault().view,
    shells: [{ path: 'pwsh.exe', name: 'PowerShell 7', args: [] }],
    systemShell: 'pwsh.exe',
    platform: 'windows',
  }
}

export function useBootstrap() {
  const ready = ref(false)
  const failure = ref<string | null>(null)
  const settings = useSettings()
  const spaces = useSpaces()
  const sessions = useSessions()
  const vault = useVault()
  const workbench = useWorkbench()
  const rememberCwd = useCwdMemory()

  terminals.configure({
    onData: (tabId, data) => {
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
    onCwd: (tabId, payload, osc) => rememberCwd(tabId, payload, osc),
  })

  async function load() {
    try {
      const bootstrap = isNative() ? await api.bootstrap() : previewBootstrap()
      settings.hydrate(bootstrap)
      vault.hydrate(bootstrap.vault)
      spaces.hydrate(bootstrap.layout)
      ready.value = true
      if (isNative()) void adoptTabNames()
      if (isNative() && !import.meta.env.DEV && settings.settings.checkForUpdates)
        void useUpdates().check()
    } catch (cause) {
      failure.value = describeError(cause)
    }
  }

  watchEffect(() => {
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
    })
  })

  void load()

  if (import.meta.env.DEV) {
    Object.assign(window, {
      __via: { spaces, sessions, workbench, settings, dnd: { dragging, hint } },
    })
  }
  return { ready, failure }
}
