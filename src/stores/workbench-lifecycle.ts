import type { Id } from '@/ipc/types'
import { locate, rowOf, rowOfTab, rows, successor, tabs, tabsOf } from '@/domain/space'
import { placeFor } from '@/domain/drop'
import { clone } from '@/lib/clone'
import type { Closed, WorkbenchParts } from './workbench-parts'

/** Internal ownership of removal, transfer, runtime cleanup and successor focus. */
export function createTabLifecycle({
  spaces,
  sessions,
  focused,
  activeTab,
  activate,
  focusTerminal,
}: WorkbenchParts) {
  /**
   * Move the whole row holding `tabOrRowId`, retaining each session and
   * repairing source focus. A tab id is focused in the destination.
   */
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

  /** Remove a tab and release its runtime only after organization accepts it. */
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
    sessions.release(tabId)
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

  /** Running pinned tabs sleep; all other tabs leave the organization. */
  function closeTab(tabId: Id): Closed | undefined {
    const space = spaces.spaceOf(tabId)
    const row = space && rowOfTab(space, tabId)
    if (!space || !row) return
    if (locate(space, row.id)?.area === 'pinned' && sessions.isLive(tabId)) {
      sessions.stop(tabId)
      return {}
    }
    return removeTab(tabId, true)
  }

  function removeSpace(spaceId: Id): boolean {
    const space = spaces.byId(spaceId)
    if (!space || !spaces.remove(spaceId)) return false
    delete focused[spaceId]
    tabs(space).forEach((tab) => sessions.release(tab.id))
    const tabId = activeTab.value?.id
    if (tabId && sessions.isLive(tabId)) focusTerminal(tabId)
    return true
  }

  return { moveRow, removeTab, closeTab, removeSpace }
}
