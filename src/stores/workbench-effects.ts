import { onScopeDispose, watch } from 'vue'
import type { Id } from '@/ipc/types'
import { findTab, locate, rowOfTab } from '@/domain/space'
import type { WorkbenchParts } from './workbench-parts'

export function installSessionEffects({
  sessions,
  spaces,
  activeTab,
  focusTerminal,
  removeTab,
}: Pick<WorkbenchParts, 'sessions' | 'spaces' | 'activeTab' | 'focusTerminal'> & {
  removeTab: (tabId: Id) => unknown
}) {
  const stopEnded = sessions.onEnded((tabId, event) => {
    const space = spaces.spaceOf(tabId)
    const tab = space && findTab(space, tabId)
    const row = space && rowOfTab(space, tabId)
    if (
      space &&
      row &&
      tab?.target.kind === 'local' &&
      locate(space, row.id)?.area === 'temporary' &&
      event.state === 'exited' &&
      event.exitCode === 0
    )
      removeTab(tabId)
  })

  const stopHostSaved = sessions.onHostSaved((tabId, hostId) => {
    const space = spaces.spaceOf(tabId)
    const tab = space && findTab(space, tabId)
    if (!space || !tab || !hostId || tab.target.kind !== 'quick') return
    spaces.dispatch(
      { type: 'updateTab', tabId: tab.id, patch: { target: { kind: 'host', hostId } } },
      space.id,
    )
  })
  onScopeDispose(() => {
    stopEnded()
    stopHostSaved()
  })

  watch(
    () => {
      const tab = activeTab.value
      return tab ? ([tab.id, sessions.runtime(tab.id).state] as const) : undefined
    },
    (current) => {
      if (current?.[1] === 'ready') focusTerminal(current[0])
    },
  )
}
