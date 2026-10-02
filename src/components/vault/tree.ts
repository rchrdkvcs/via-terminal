/** The group tree, its counts, and the flattened order used by selects. */
import type { Group, Host, Id } from '@/ipc/types'

export interface TreeNode {
  group: Group
  depth: number
  children: TreeNode[]
  /** Hosts in this group and every sub-group. */
  count: number
}

function byPosition(a: Group, b: Group): number {
  return a.position - b.position || a.name.localeCompare(b.name)
}

export function buildTree(groups: Group[], hosts: Pick<Host, 'groupId'>[]): TreeNode[] {
  const direct = new Map<Id, number>()
  for (const host of hosts) {
    if (host.groupId) direct.set(host.groupId, (direct.get(host.groupId) ?? 0) + 1)
  }
  const known = new Set(groups.map((group) => group.id))
  const seen = new Set<Id>()
  // A group whose parent is missing shows at the root rather than vanishing.
  const isChild = (group: Group, parentId: Id | null) =>
    parentId ? group.parentId === parentId : !group.parentId || !known.has(group.parentId)
  const build = (parentId: Id | null, depth: number): TreeNode[] =>
    groups
      .filter((group) => isChild(group, parentId) && !seen.has(group.id))
      .sort(byPosition)
      .map((group) => {
        seen.add(group.id)
        const children = build(group.id, depth + 1)
        const count = children.reduce((sum, node) => sum + node.count, direct.get(group.id) ?? 0)
        return { group, depth, children, count }
      })
  return build(null, 0)
}

/** Depth-first order, for a select that shows the hierarchy by indentation. */
export function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}

/** A group and all its sub-groups: the scope of "hosts in this group". */
export function subtree(groups: Group[], id: Id): Set<Id> {
  const scope = new Set<Id>([id])
  let grew = true
  while (grew) {
    grew = false
    for (const group of groups) {
      if (group.parentId && scope.has(group.parentId) && !scope.has(group.id)) {
        scope.add(group.id)
        grew = true
      }
    }
  }
  return scope
}
