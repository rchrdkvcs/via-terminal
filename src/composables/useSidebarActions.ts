import type { Id } from '@/ipc/types'
import { placeFor, type DropPosition } from '@/domain/drop'
import type { Edge } from '@/domain/split'
import { findTab } from '@/domain/space'
import { useSpaces } from '@/stores/spaces'
import { useVault } from '@/stores/vault'
import { useWorkbench } from '@/stores/workbench'

export function useSidebarActions() {
  const spaces = useSpaces()
  const workbench = useWorkbench()
  const vault = useVault()

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

  function dropInFolder(sourceId: Id, folderId: Id) {
    spaces.dispatch({ type: 'move', id: sourceId, to: { area: 'pinned', folderId, before: null } })
  }

  function dropAtStart(sourceId: Id) {
    const first = spaces.active.temporary[0]?.id ?? null
    spaces.dispatch({ type: 'move', id: sourceId, to: { area: 'temporary', before: first } })
  }

  function splitWithActive(sourceId: Id, edge: Edge) {
    const target = workbench.activeRow
    if (!target || target.id === sourceId) return
    workbench.splitWith(sourceId, workbench.activeTab!.id, edge)
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
    const target = findTab(spaces.active, tabId)?.target
    if (value && target?.kind === 'host' && vault.isUnnamed(target.hostId)) {
      spaces.dispatch({ type: 'updateTab', tabId, patch: { title: null } })
      void vault.rename(target.hostId, value).catch(() => undefined)
      return
    }
    spaces.dispatch({ type: 'updateTab', tabId, patch: { title: value || null } })
  }

  return {
    dropOnRow,
    dropAtEnd,
    dropInFolder,
    dropAtStart,
    splitWithActive,
    newFolder,
    rename,
  }
}
