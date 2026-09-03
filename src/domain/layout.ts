import type { Id, PaneTree, SplitDirection, SplitTabTree } from '@/ipc/types'

export type PaneNode =
  | { kind: 'pane'; id: string; sessionId: Id }
  | {
      kind: 'split'
      id: string
      direction: SplitDirection
      ratio: number
      first: PaneNode
      second: PaneNode
    }

export type RuntimeSplitTree =
  | { kind: 'tab'; tabId: Id }
  | {
      kind: 'split'
      id: string
      direction: SplitDirection
      ratio: number
      first: RuntimeSplitTree
      second: RuntimeSplitTree
    }

export function firstPane(node: PaneNode): Extract<PaneNode, { kind: 'pane' }> | null {
  if (node.kind === 'pane') return node
  return firstPane(node.first) ?? firstPane(node.second)
}

export function findPane(
  node: PaneNode,
  predicate: (pane: Extract<PaneNode, { kind: 'pane' }>) => boolean,
): Extract<PaneNode, { kind: 'pane' }> | null {
  if (node.kind === 'pane') return predicate(node) ? node : null
  return findPane(node.first, predicate) ?? findPane(node.second, predicate)
}

export function findPaneById(node: PaneNode, paneId: string) {
  return findPane(node, (pane) => pane.id === paneId)
}

export function findPaneBySession(node: PaneNode, sessionId: Id) {
  return findPane(node, (pane) => pane.sessionId === sessionId)
}

export function paneSessionIds(node: PaneNode): Id[] {
  return node.kind === 'pane'
    ? [node.sessionId]
    : [...paneSessionIds(node.first), ...paneSessionIds(node.second)]
}

export function removePane(node: PaneNode, paneId: string): PaneNode | null {
  if (node.kind === 'pane') return node.id === paneId ? null : node
  const first = removePane(node.first, paneId)
  const second = removePane(node.second, paneId)
  if (!first) return second
  if (!second) return first
  return { ...node, first, second }
}

export function replaceSession(node: PaneNode, from: Id, to: Id): PaneNode {
  if (node.kind === 'pane') return node.sessionId === from ? { ...node, sessionId: to } : node
  return {
    ...node,
    first: replaceSession(node.first, from, to),
    second: replaceSession(node.second, from, to),
  }
}

export function setPaneSplitRatio(node: PaneNode, splitId: string, ratio: number): PaneNode {
  if (node.kind === 'pane') return node
  if (node.id === splitId) return { ...node, ratio: clampRatio(ratio) }
  return {
    ...node,
    first: setPaneSplitRatio(node.first, splitId, ratio),
    second: setPaneSplitRatio(node.second, splitId, ratio),
  }
}

export function paneTreeToWire(node: PaneNode): PaneTree {
  return node.kind === 'pane'
    ? { kind: 'pane', sessionId: node.sessionId }
    : {
        kind: 'split',
        direction: node.direction,
        ratio: node.ratio,
        first: paneTreeToWire(node.first),
        second: paneTreeToWire(node.second),
      }
}

export function splitTreeToWire(node: RuntimeSplitTree): SplitTabTree {
  return node.kind === 'tab'
    ? { kind: 'tab', tabId: node.tabId }
    : {
        kind: 'split',
        direction: node.direction,
        ratio: node.ratio,
        first: splitTreeToWire(node.first),
        second: splitTreeToWire(node.second),
      }
}

export function splitTreeFromWire(node: SplitTabTree, createId: () => string): RuntimeSplitTree {
  return node.kind === 'tab'
    ? { kind: 'tab', tabId: node.tabId }
    : {
        kind: 'split',
        id: createId(),
        direction: node.direction,
        ratio: node.ratio,
        first: splitTreeFromWire(node.first, createId),
        second: splitTreeFromWire(node.second, createId),
      }
}

export function splitTabIds(node: RuntimeSplitTree): Id[] {
  return node.kind === 'tab'
    ? [node.tabId]
    : [...splitTabIds(node.first), ...splitTabIds(node.second)]
}

export function removeSplitTab(node: RuntimeSplitTree, tabId: Id): RuntimeSplitTree | null {
  if (node.kind === 'tab') return node.tabId === tabId ? null : node
  const first = removeSplitTab(node.first, tabId)
  const second = removeSplitTab(node.second, tabId)
  if (!first) return second
  if (!second) return first
  return { ...node, first, second }
}

export function replaceSplitTab(
  node: RuntimeSplitTree,
  tabId: Id,
  replacement: RuntimeSplitTree,
): RuntimeSplitTree {
  if (node.kind === 'tab') return node.tabId === tabId ? replacement : node
  return {
    ...node,
    first: replaceSplitTab(node.first, tabId, replacement),
    second: replaceSplitTab(node.second, tabId, replacement),
  }
}

export function setGroupSplitRatio(
  node: RuntimeSplitTree,
  splitId: string,
  ratio: number,
): RuntimeSplitTree {
  if (node.kind === 'tab') return node
  if (node.id === splitId) return { ...node, ratio: clampRatio(ratio) }
  return {
    ...node,
    first: setGroupSplitRatio(node.first, splitId, ratio),
    second: setGroupSplitRatio(node.second, splitId, ratio),
  }
}

function clampRatio(ratio: number): number {
  return Math.min(0.85, Math.max(0.15, ratio))
}
