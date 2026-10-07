import type { Group, Host, Id } from '@/ipc/types'

export interface TreeNode {
  group: Group
  depth: number
  children: TreeNode[]

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

export function flatten(nodes: TreeNode[]): TreeNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}

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
