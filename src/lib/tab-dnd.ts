import type { Options, SortableEvent } from 'vue-draggable-plus'
import { useAppStore } from '@/stores/app'
import { activeDrag, endSidebarDrag } from '@/lib/sidebar-dnd'

export type TabContainer = 'pinned' | 'open' | 'folder'

export function finishTabMove(event: SortableEvent) {
  const tabId = event.item.dataset.tabId
  const container = event.to as HTMLElement
  const location = container.dataset.tabContainer as TabContainer | undefined
  if (!tabId || !location) {
    endSidebarDrag()
    return
  }

  const rows = Array.from(container.querySelectorAll<HTMLElement>(':scope > .terminal-tab'))
  const index = rows.indexOf(event.item)
  const beforeId = rows[index + 1]?.dataset.tabId ?? null
  const store = useAppStore()

  if (location === 'pinned') void store.pinTab(tabId, beforeId)
  else if (location === 'open') void store.unpinTab(tabId, beforeId)
  else {
    const folderId = container.dataset.folderId
    if (folderId) void store.placeTab(tabId, folderId, beforeId)
  }
  endSidebarDrag()
}

/** One SortableJS configuration shared by every terminal-tab container. */
export function tabSortableOptions(acceptTabs = true): Options {
  return {
    group: { name: 'terminal-tabs', pull: true, put: acceptTabs },
    draggable: '.terminal-tab',
    animation: 150,
    direction: 'vertical',
    forceFallback: true,
    fallbackOnBody: true,
    fallbackTolerance: 4,
    ghostClass: 'tab-sortable-ghost',
    chosenClass: 'tab-sortable-chosen',
    dragClass: 'tab-sortable-drag',
    filter: 'input, button[data-tab-action]',
    preventOnFilter: false,
    onStart(event) {
      const id = event.item.dataset.tabId
      if (id) activeDrag.value = { type: 'tab', id }
    },
    onEnd: finishTabMove,
  }
}
