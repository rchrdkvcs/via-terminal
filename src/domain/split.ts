import type { Direction, Id, Split, Tab } from '@/ipc/types'
import { slot, take } from './lists'
import { type Space, newTabRow, rows, tabFromRow } from './space'

export type Edge = 'left' | 'right' | 'top' | 'bottom'

export const MAX_SPLIT = 4

export function directionOf(edge: Edge): Direction {
  return edge === 'left' || edge === 'right' ? 'horizontal' : 'vertical'
}

export function canSplit(space: Space, source: Id, target: Id, edge: Edge): boolean {
  const all = rows(space)
  const sourceRow = all.find((row) => row.id === source)
  const targetRow = all.find((row) => row.id === target)
  if (source === target || sourceRow?.kind !== 'tab' || !targetRow) return false
  if (targetRow.kind === 'tab') return true
  return targetRow.direction === directionOf(edge) && targetRow.tabs.length < MAX_SPLIT
}

export function splitWith(space: Space, source: Id, target: Id, edge: Edge): boolean {
  if (!canSplit(space, source, target, edge)) return false
  const sourceRow = take(space, source)
  const at = slot(space, target)
  const targetRow = at?.list[at.index]
  if (sourceRow?.kind !== 'tab' || !at || !targetRow || targetRow.kind === 'folder') return false
  const tab = tabFromRow(sourceRow)
  const first = edge === 'left' || edge === 'top'
  if (targetRow.kind === 'split') {
    const size = targetRow.sizes.reduce((sum, value) => sum + value, 0) / targetRow.sizes.length
    targetRow.tabs.splice(first ? 0 : targetRow.tabs.length, 0, tab)
    targetRow.sizes.splice(first ? 0 : targetRow.sizes.length, 0, size)
    return true
  }
  const other = tabFromRow(targetRow)
  at.list[at.index] = {
    kind: 'split',
    id: crypto.randomUUID(),
    direction: directionOf(edge),
    sizes: [1, 1],
    tabs: first ? [tab, other] : [other, tab],
  }
  return true
}

function extract(space: Space, tabId: Id): { tab: Tab; splitId: Id } | undefined {
  const split = rows(space).find(
    (row): row is { kind: 'split' } & Split =>
      row.kind === 'split' && row.tabs.some((tab) => tab.id === tabId),
  )
  const at = split && slot(space, split.id)
  if (!split || !at) return undefined
  const position = split.tabs.findIndex((tab) => tab.id === tabId)
  const [tab] = split.tabs.splice(position, 1)
  split.sizes.splice(position, 1)
  if (split.tabs.length === 1) at.list[at.index] = newTabRow(split.tabs[0])
  return { tab, splitId: split.tabs.length === 1 ? split.tabs[0].id : split.id }
}

export function detach(space: Space, tabId: Id): boolean {
  const extracted = extract(space, tabId)
  const at = extracted && slot(space, extracted.splitId)
  if (!extracted || !at) return false
  at.list.splice(at.index + 1, 0, newTabRow(extracted.tab))
  return true
}

export function dropTab(space: Space, tabId: Id): boolean {
  return extract(space, tabId) !== undefined
}

export function resize(space: Space, splitId: Id, sizes: number[]): boolean {
  const split = rows(space).find((row) => row.id === splitId)
  if (split?.kind !== 'split' || sizes.length !== split.tabs.length) return false
  if (!sizes.every((size) => Number.isFinite(size) && size > 0)) return false
  split.sizes = sizes
  return true
}
