import { defineStore } from 'pinia'
import { computed, onScopeDispose, reactive, readonly, watch } from 'vue'
import type { Id, Tab, TabView, Target } from '@/ipc/types'
import {
  type Space,
  findTab,
  locate,
  newTabRow,
  rowOf,
  rowOfTab,
  rows,
  successor,
  tabs,
  tabsOf,
} from '@/domain/space'
import { placeFor } from '@/domain/drop'
import type { Edge } from '@/domain/split'
import { clone } from '@/lib/clone'
import { terminals } from '@/terminal/registry'
import { useFiles } from './files'
import { useSessions } from './sessions'
import { useSpaces } from './spaces'

export interface Closed {
  undo?: () => boolean
}

/**
 * Tabs, their focus and their runtime. Closing, replacing and removing release the
 * sessions and explorers they end without asking anything: `useClosing` is their only
 * caller, after the user agreed to what they lose.
 */
export const useWorkbench = defineStore('workbench', () => {
  const spaces = useSpaces()
  const sessions = useSessions()
  const files = useFiles()
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

  function stop(tabId: Id) {
    sessions.stop(tabId)
    files.release(tabId)
  }

  function release(tabId: Id) {
    sessions.release(tabId)
    files.release(tabId)
  }

  function open(target: Target): Id | undefined {
    const row = newTabRow({ id: crypto.randomUUID(), title: null, target })
    if (!spaces.dispatch({ type: 'open', row })) return
    activate(row.id)
    return row.id
  }

  function replace(tabId: Id, target: Target): Id | undefined {
    const space = spaces.spaceOf(tabId)
    if (
      !space ||
      !spaces.dispatch(
        {
          type: 'updateTab',
          tabId,
          patch: { target, title: null, remoteCwd: null, view: undefined },
        },
        space.id,
      )
    )
      return
    stop(tabId)
    activate(tabId)
    return tabId
  }

  /**
   * Shows a remote explorer or document of `source`'s target in its own tab, right after
   * `source` when that one is temporary. A document already open in the space is reused.
   */
  function openView(source: Tab, view: TabView): Id | undefined {
    const space = spaces.spaceOf(source.id)
    if (!space || source.target.kind === 'local') return
    const same = JSON.stringify(source.target)
    const existing =
      view.kind === 'document' &&
      tabs(space).find(
        (tab) =>
          tab.view?.kind === 'document' &&
          tab.view.path === view.path &&
          JSON.stringify(tab.target) === same,
      )
    if (existing) {
      activate(existing.id)
      return existing.id
    }
    const anchor = rowOfTab(space, source.id)
    const to =
      anchor && locate(space, anchor.id)?.area === 'temporary'
        ? (placeFor(space, anchor.id, 'after') ?? undefined)
        : undefined
    const row = newTabRow({
      id: crypto.randomUUID(),
      title: null,
      target: clone(source.target),
      view,
    })
    if (!spaces.dispatch({ type: 'open', row, to }, space.id)) return
    activate(row.id)
    return row.id
  }

  function openBeside(target: Target, anchorTabId: Id, edge: Edge = 'right'): Id | undefined {
    const space = spaces.spaceOf(anchorTabId)
    const anchor = space && rowOfTab(space, anchorTabId)
    if (!space || !anchor) return
    const row = newTabRow({ id: crypto.randomUUID(), title: null, target })
    if (
      !spaces.dispatch(
        [
          { type: 'open', row },
          { type: 'split', source: row.id, target: anchor.id, edge },
        ],
        space.id,
      )
    )
      return
    activate(row.id)
    return row.id
  }

  function splitWith(sourceTabId: Id, anchorTabId: Id, edge: Edge = 'right'): boolean {
    const space = spaces.spaceOf(anchorTabId)
    const source = space && rowOfTab(space, sourceTabId)
    const anchor = space && rowOfTab(space, anchorTabId)
    if (!space || !source || !anchor || source.kind !== 'tab') return false
    if (!spaces.dispatch({ type: 'split', source: source.id, target: anchor.id, edge }, space.id))
      return false
    activate(sourceTabId)
    return true
  }

  function detach(tabId: Id): boolean {
    const space = spaces.spaceOf(tabId)
    if (!space || !spaces.dispatch({ type: 'detach', tabId }, space.id)) return false
    activate(tabId, { wake: false })
    return true
  }

  function moveRow(tabOrRowId: Id, toSpaceId: Id): boolean {
    const space = spaces.spaceOf(tabOrRowId)
    const row = space && rowOf(space, tabOrRowId)
    if (!space || !row) return false
    const all = rows(space)
    const index = all.findIndex((candidate) => candidate.id === row.id)
    const neighbor = all[index + 1] ?? all[index - 1]
    const moving = tabsOf(row)
    const tabId =
      moving.find((tab) => tab.id === tabOrRowId)?.id ??
      moving.find((tab) => tab.id === focused[space.id])?.id ??
      moving[0].id
    if (!spaces.transfer(row.id, toSpaceId)) return false
    if (moving.some((tab) => tab.id === focused[space.id]))
      focused[space.id] = neighbor && tabsOf(neighbor)[0].id
    activate(tabId, { wake: false })
    return true
  }

  function removeTab(tabId: Id, undoable = false): Closed | undefined {
    const space = spaces.spaceOf(tabId)
    const row = space && rowOfTab(space, tabId)
    if (!space || !row) return
    const next = successor(space, tabId)
    const snapshot = clone(row)
    const place = placeFor(space, row.id, 'after')
    const pinned = locate(space, row.id)?.area === 'pinned'
    if (!spaces.dispatch({ type: 'remove', id: row.kind === 'split' ? tabId : row.id }, space.id))
      return
    if (focused[space.id] === tabId) {
      focused[space.id] = next
      if (next && sessions.isLive(next)) focusTerminal(next)
    }
    release(tabId)
    if (!undoable || !pinned || row.kind !== 'tab' || !place) return {}
    let restored = false
    return {
      undo: () => {
        if (restored || spaces.spaceOf(tabId)) return false
        restored = spaces.dispatch({ type: 'open', row: clone(snapshot), to: place }, space.id)
        return restored
      },
    }
  }

  function closeTab(tabId: Id): Closed | undefined {
    const space = spaces.spaceOf(tabId)
    const row = space && rowOfTab(space, tabId)
    if (!space || !row) return
    if (locate(space, row.id)?.area === 'pinned' && sessions.isLive(tabId)) {
      stop(tabId)
      return {}
    }
    return removeTab(tabId, true)
  }

  function removeSpace(spaceId: Id): boolean {
    const space = spaces.byId(spaceId)
    if (!space || !spaces.remove(spaceId)) return false
    delete focused[spaceId]
    tabs(space).forEach((tab) => release(tab.id))
    const tabId = activeTab.value?.id
    if (tabId && sessions.isLive(tabId)) focusTerminal(tabId)
    return true
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
    [
      () => activeTab.value?.id,
      () => {
        const tab = activeTab.value
        return tab ? sessions.runtime(tab.id).state : undefined
      },
    ],
    ([id, state]) => {
      if (id && state === 'ready') focusTerminal(id)
    },
  )

  return {
    focused: readonly(focused),
    activeTab,
    activeRow,
    activate,
    open,
    replace,
    openView,
    openBeside,
    splitWith,
    detach,
    moveRow,
    closeTab,
    removeSpace,
    reconnect,
    togglePin,
    cycle,
  }
})
