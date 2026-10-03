import { describe, expect, it } from 'vitest'
import type { Row } from '@/ipc/types'
import { type Space, rowOf, successor } from './space'

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

describe('rowOf', () => {
  it('finds a row by its own id or by a tab it holds', () => {
    const split: Row = {
      kind: 'split',
      id: 'x',
      direction: 'horizontal',
      sizes: [1, 1],
      tabs: [tab('a'), tab('b')] as never,
    }
    const value = space([split])
    expect(rowOf(value, 'x')).toBe(split)
    expect(rowOf(value, 'b')).toBe(split)
    expect(rowOf(value, 'p')?.id).toBe('p')
    expect(rowOf(value, 'missing')).toBeUndefined()
  })
})
