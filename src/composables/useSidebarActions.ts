import type { Id } from '@/ipc/types'
import { placeFor, type DropPosition } from '@/domain/drop'
import type { Edge } from '@/domain/split'
import { rowOfTab } from '@/domain/space'
import { useSpaces } from '@/stores/spaces'
import { useWorkbench } from '@/stores/workbench'

/** What sidebar gestures and menus mean, as organize intents. */
export function useSidebarActions() {
  const spaces = useSpaces()
  const workbench = useWorkbench()

  function dropOnRow(sourceId: Id, targetId: Id, position: DropPosition) {
    const place = placeFor(spaces.active, targetId, position)
    if (place) spaces.dispatch({ type: 'move', id: sourceId, to: place })
  }

  function dropAtEnd(sourceId: Id, area: 'pinned' | 'temporary') {
    const to =
      area === 'pinned'
        ? ({ area, folderId: null, before: null } as const)
        : ({ area, before: null } as const)
    spaces.dispatch({ type: 'move', id: sourceId, to })
  }

  /** Dropped on an edge of the content: split with the visible row. */
  function splitWithActive(sourceId: Id, edge: Edge) {
    const target = workbench.activeRow
    if (!target || target.id === sourceId) return
    if (spaces.dispatch({ type: 'split', source: sourceId, target: target.id, edge })) {
      workbench.activate(sourceId)
    }
  }

  function detach(tabId: Id) {
    spaces.dispatch({ type: 'detach', tabId })
    workbench.activate(tabId, { wake: false })
  }

  function newFolder() {
    const id = crypto.randomUUID()
    spaces.dispatch({
      type: 'createFolder',
      folder: { kind: 'folder', id, name: 'Nouveau dossier', open: true, rows: [] },
      before: null,
    })
    return id
  }

  function rename(tabId: Id, title: string) {
    const value = title.trim()
    spaces.dispatch({ type: 'updateTab', tabId, patch: { title: value || null } })
  }

  function moveToSpace(tabId: Id, spaceId: Id) {
    const row = rowOfTab(spaces.active, tabId)
    if (row && spaces.transfer(row.id, spaceId)) workbench.activate(tabId, { wake: false })
  }

  return { dropOnRow, dropAtEnd, splitWithActive, detach, newFolder, rename, moveToSpace }
}
