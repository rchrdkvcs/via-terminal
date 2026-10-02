import { watch } from 'vue'
import { on } from '@/ipc/events'
import { findTab, locate, rowOfTab } from '@/domain/space'
import { terminals } from '@/terminal/registry'
import { useSessions } from '@/stores/sessions'
import { useSpaces } from '@/stores/spaces'
import { useWorkbench } from '@/stores/workbench'
import { useTabClosing } from './useTabClosing'

/** How the organization reacts to what sessions report. */
export function useSessionEffects() {
  const sessions = useSessions()
  const spaces = useSpaces()
  const workbench = useWorkbench()
  const closing = useTabClosing()

  // A temporary local shell that exits normally closes its tab.
  sessions.onEnded((tabId, event) => {
    const space = spaces.spaceOf(tabId)
    const tab = space && findTab(space, tabId)
    const row = space && rowOfTab(space, tabId)
    const temporary = row && locate(space, row.id)?.area === 'temporary'
    if (
      tab?.target.kind === 'local' &&
      temporary &&
      event.state === 'exited' &&
      event.exitCode === 0
    ) {
      closing.remove(space, tabId, false)
    }
  })

  // A quick connect that joined the vault now points at its host.
  on('vault-changed', ({ sessionId, hostId }) => {
    const tabId = sessions.tabOf(sessionId)
    const space = tabId ? spaces.spaceOf(tabId) : undefined
    const tab = tabId && space ? findTab(space, tabId) : undefined
    if (!tab || !hostId || tab.target.kind !== 'quick') return
    spaces.dispatch(
      { type: 'updateTab', tabId: tab.id, patch: { target: { kind: 'host', hostId } } },
      space!.id,
    )
  })

  // Once a session is ready, typing goes to it, even if a prompt had the focus.
  watch(
    () => {
      const tab = workbench.activeTab
      return tab ? `${tab.id}:${sessions.runtime(tab.id).state}` : ''
    },
    (key) => {
      const [tabId, state] = key.split(':')
      if (state === 'ready') requestAnimationFrame(() => terminals.focus(tabId))
    },
  )
}
