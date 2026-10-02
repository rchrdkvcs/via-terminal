import { describe, expect, it } from 'vitest'
import type { Row } from '@/ipc/types'
import { type Space, successor } from './space'

const tab = (id: string): Row => ({
  kind: 'tab',
  id,
  title: null,
  target: { kind: 'local', shell: null, cwd: null },
})
const space = (temporary: Row[]): Space => ({
  id: 's',
  name: 'S',
  icon: 'terminal',
  color: 'slate',
  defaultShell: null,
  pinned: [tab('p')],
  temporary,
})

describe('successor', () => {
  it('prefers a split sibling, then the next row, then the previous one', () => {
    const split: Row = {
      kind: 'split',
      id: 'x',
      direction: 'horizontal',
      sizes: [1, 1],
      tabs: [tab('a'), tab('b')] as never,
    }
    expect(successor(space([split, tab('c')]), 'a')).toBe('b')
    expect(successor(space([tab('a'), tab('c')]), 'a')).toBe('c')
    expect(successor(space([tab('a'), tab('c')]), 'c')).toBe('a')
    expect(successor({ ...space([]), pinned: [tab('only')] }, 'only')).toBeUndefined()
  })
})
