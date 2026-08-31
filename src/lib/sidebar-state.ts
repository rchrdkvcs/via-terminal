import type { Id } from '@/ipc/types'

export interface SidebarNavigationState {
  collapsedFolders: Record<Id, Id[]>
  collapsedWorkspaces: Id[]
}

const STORAGE_KEY = 'via-terminal.sidebar-navigation'
const emptyState = (): SidebarNavigationState => ({ collapsedFolders: {}, collapsedWorkspaces: [] })

export function loadSidebarNavigation(): SidebarNavigationState {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? '{}',
    ) as Partial<SidebarNavigationState>
    return {
      collapsedFolders: parsed.collapsedFolders ?? {},
      collapsedWorkspaces: parsed.collapsedWorkspaces ?? [],
    }
  } catch {
    return emptyState()
  }
}

export function saveSidebarNavigation(value: SidebarNavigationState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // The navigation remains usable when local storage is unavailable.
  }
}
