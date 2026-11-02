import { watch } from 'vue'
import { tabs } from '@/domain/space'
import { useFiles } from '@/stores/files'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useWorkbench } from '@/stores/workbench'

/**
 * Opens the remote explorer of an SSH terminal once per connection, where the settings say:
 * beside it, or as an explorer tab added next to it (asleep until opened). An explorer tab of
 * the same target already in the space is enough.
 */
export function useFilesAutoOpen() {
  const files = useFiles()
  const sessions = useSessions()
  const settings = useSettings()
  const spaces = useSpaces()
  const workbench = useWorkbench()
  const handled = new Set<string>()

  watch(
    () => {
      const tab = workbench.activeTab
      if (!tab || tab.view || tab.target.kind === 'local') return null
      const runtime = sessions.runtime(tab.id)
      return runtime.state === 'ready' && runtime.sessionId ? runtime.sessionId : null
    },
    (sessionId) => {
      const tab = workbench.activeTab
      const mode = settings.settings.filesAutoOpen
      if (!sessionId || !tab || handled.has(sessionId)) return
      handled.add(sessionId)
      if (mode === 'panel') files.setVisible(tab.id, true)
      if (mode !== 'tab') return
      const same = JSON.stringify(tab.target)
      const space = spaces.spaceOf(tab.id)
      const open =
        space &&
        tabs(space).some(
          (other) => other.view?.kind === 'files' && JSON.stringify(other.target) === same,
        )
      if (!open)
        workbench.openView(tab, { kind: 'files', path: tab.remoteCwd ?? null }, { activate: false })
    },
  )
}
