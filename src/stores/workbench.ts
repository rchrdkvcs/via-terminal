import { defineStore } from 'pinia'
import { computed, reactive } from 'vue'
import type { Id, Target } from '@/ipc/types'
import { type Space, findTab, locate, newTabRow, rowOfTab, rows, tabs } from '@/domain/space'
import { terminals } from '@/terminal/registry'
import { useSessions } from './sessions'
import { useSpaces } from './spaces'

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
    requestAnimationFrame(() => terminals.focus(tabId))
  }

  /** Open `target` in a new temporary tab, or in place of `replace`. Returns the tab id. */
  function open(target: Target, options: { replace?: Id } = {}): Id {
    if (options.replace) {
      sessions.stop(options.replace)
      spaces.dispatch({ type: 'updateTab', tabId: options.replace, patch: { target, title: null } })
      activate(options.replace)
      return options.replace
    }
    const row = newTabRow({ id: crypto.randomUUID(), title: null, target })
    spaces.dispatch({ type: 'open', row })
    activate(row.id)
    return row.id
  }

  function reconnect(tabId: Id) {
    const space = spaces.spaceOf(tabId)
    if (space) wake(space, tabId)
  }

  function togglePin(rowId: Id) {
    const space = spaces.spaceOf(rowId)
    if (!space) return
    const row = rowOfTab(space, rowId) ?? rows(space).find((candidate) => candidate.id === rowId)
    if (!row) return
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

  return {
    focused,
    activeTab,
    activeRow,
    activate,
    open,
    reconnect,
    togglePin,
    cycle,
  }
})
