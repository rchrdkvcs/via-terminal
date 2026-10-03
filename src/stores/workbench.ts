import { defineStore } from 'pinia'
import { computed, reactive, readonly } from 'vue'
import type { Id } from '@/ipc/types'
import { type Space, findTab, locate, rowOf, rowOfTab, tabs } from '@/domain/space'
import { terminals } from '@/terminal/registry'
import { useSessions } from './sessions'
import { useSpaces } from './spaces'
import { installSessionEffects } from './workbench-effects'
import { createTabLifecycle } from './workbench-lifecycle'
import { createTabOpening } from './workbench-opening'
import type { WorkbenchParts } from './workbench-parts'

/**
 * What the user works on: the focused tab of each space, and the tab
 * lifecycle rules (open, wake, close, pin) on top of spaces and sessions.
 */
export const useWorkbench = defineStore('workbench', () => {
  const spaces = useSpaces()
  const sessions = useSessions()
  const focused = reactive<Record<Id, Id | undefined>>({})

  const activeTab = computed(() => {
    const id = focused[spaces.active?.id]
    return id ? findTab(spaces.active, id) : undefined
  })
  const activeRow = computed(() =>
    activeTab.value ? rowOfTab(spaces.active, activeTab.value.id) : undefined,
  )

  function wake(space: Space, tabId: Id) {
    const tab = findTab(space, tabId)
    if (tab && !sessions.isLive(tabId)) void sessions.start(tab, space.defaultShell)
  }

  /** Focus a tab, waking it if asleep. Waking is always an explicit act. */
  function activate(tabId: Id, options: { wake?: boolean } = {}) {
    const space = spaces.spaceOf(tabId)
    if (!space) return
    spaces.activate(space.id)
    focused[space.id] = tabId
    const state = sessions.runtime(tabId).state
    if (options.wake !== false && state === 'asleep') wake(space, tabId)
    focusTerminal(tabId)
  }

  function focusTerminal(tabId: Id) {
    requestAnimationFrame(() => {
      if (activeTab.value?.id === tabId) terminals.focus(tabId)
    })
  }

  function reconnect(tabId: Id) {
    const space = spaces.spaceOf(tabId)
    if (space) wake(space, tabId)
  }

  function togglePin(tabOrRowId: Id) {
    const space = spaces.spaceOf(tabOrRowId)
    const row = space && rowOf(space, tabOrRowId)
    if (!space || !row) return
    const pinned = locate(space, row.id)?.area === 'pinned'
    spaces.dispatch(
      {
        type: 'move',
        id: row.id,
        to: pinned
          ? { area: 'temporary', before: space.temporary[0]?.id ?? null }
          : { area: 'pinned', folderId: null, before: null },
      },
      space.id,
    )
  }

  function cycle(direction: 1 | -1) {
    const all = tabs(spaces.active)
    if (!all.length) return
    const index = all.findIndex((tab) => tab.id === activeTab.value?.id)
    activate(all[(index + direction + all.length) % all.length].id)
  }

  const parts: WorkbenchParts = { spaces, sessions, focused, activeTab, activate, focusTerminal }
  const opening = createTabOpening(parts)
  const lifecycle = createTabLifecycle(parts)
  installSessionEffects({ ...parts, removeTab: lifecycle.removeTab })

  return {
    focused: readonly(focused),
    activeTab,
    activeRow,
    activate,
    ...opening,
    ...lifecycle,
    reconnect,
    togglePin,
    cycle,
  }
})
