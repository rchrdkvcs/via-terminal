import { describe, expect, it } from 'vitest'
import type { Group } from '@/ipc/types'
import { buildTree, flatten, subtree } from './tree'

const defaults = { username: null, port: null, identityId: null }
const group = (id: string, parentId: string | null, position = 0): Group => ({
  id,
  parentId,
  name: id,
  position,
  defaults,
})
const groups = [group('b', null, 1), group('a', null, 0), group('a1', 'a'), group('a1x', 'a1')]
const hosts = [{ groupId: 'a1x' }, { groupId: 'a' }, { groupId: null }, { groupId: 'b' }]

describe('buildTree', () => {
  it('nests groups in position order', () => {
    const tree = buildTree(groups, hosts)
    expect(tree.map((node) => node.group.id)).toEqual(['a', 'b'])
    expect(tree[0].children[0].children[0].group.id).toBe('a1x')
    expect(tree[0].children[0].children[0].depth).toBe(2)
  })

  it('counts hosts of sub-groups', () => {
    const [a, b] = buildTree(groups, hosts)
    expect(a.count).toBe(2)
    expect(a.children[0].count).toBe(1)
    expect(b.count).toBe(1)
  })

  it('shows orphans at the root and drops cycles', () => {
    const tree = buildTree([group('o', 'missing'), group('x', 'y'), group('y', 'x')], [])
    expect(tree.map((node) => node.group.id)).toEqual(['o'])
  })
})

describe('flatten and subtree', () => {
  it('lists groups depth-first', () => {
    expect(flatten(buildTree(groups, [])).map((node) => node.group.id)).toEqual([
      'a',
      'a1',
      'a1x',
      'b',
    ])
  })

  it('collects a group and its descendants', () => {
    expect([...subtree(groups, 'a')].sort()).toEqual(['a', 'a1', 'a1x'])
    expect([...subtree(groups, 'b')]).toEqual(['b'])
  })
})
