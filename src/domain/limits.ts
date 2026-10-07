import { isFolder, rows, tabs, type Space } from './space'

export const LAYOUT_LIMITS = {
  nameLength: 80,
  titleLength: 200,
  splitTabs: { min: 2, max: 4 },
  sidebarWidth: { min: 160, max: 640 },
} as const

export function fitsLength(value: string, max: number): boolean {
  return value.trim().length > 0 && [...value].length <= max
}

export function clampSidebarWidth(width: number): number {
  const { min, max } = LAYOUT_LIMITS.sidebarWidth
  return Math.round(Math.min(max, Math.max(min, width)))
}

export function withinLimits(space: Space): boolean {
  const { nameLength, titleLength, splitTabs } = LAYOUT_LIMITS
  const folders = space.pinned.filter(isFolder)
  return (
    fitsLength(space.name, nameLength) &&
    folders.every((folder) => fitsLength(folder.name, nameLength)) &&
    tabs(space).every(
      (tab) => typeof tab.title !== 'string' || fitsLength(tab.title, titleLength),
    ) &&
    rows(space).every(
      (row) =>
        row.kind !== 'split' ||
        (row.tabs.length >= splitTabs.min && row.tabs.length <= splitTabs.max),
    )
  )
}
