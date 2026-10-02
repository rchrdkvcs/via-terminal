import { describe, expect, it } from 'vitest'
import type { Folder, Row } from '@/ipc/types'
import { apply, type Intent } from './organize'
import { type Space, locate, rows, tabs } from './space'

const tab = (id: string): Row => ({
  kind: 'tab',
  id,
  title: null,
  target: { kind: 'local', shell: null, cwd: null },
})
const folder = (id: string, rowsInside: Row[] = []): Folder => ({
  kind: 'folder',
  id,
  name: id,
  open: true,
  rows: rowsInside,
})

function space(pinned: Space['pinned'] = [], temporary: Row[] = []): Space {
  return {
    id: 's',
    name: 'S',
    icon: 'terminal',
    color: 'slate',
    defaultShell: null,
    pinned,
    temporary,
  }
}

function must(state: Space, intent: Intent): Space {
  const next = apply(state, intent)
  expect(next).not.toBeNull()
  // Identity invariant: every tab appears exactly once.
  const ids = tabs(next!).map((t) => t.id)
  expect(new Set(ids).size).toBe(ids.length)
  return next!
}

describe('organize', () => {
  it('opens new tabs at the top of the temporary area', () => {
    const next = must(space([], [tab('a')]), { type: 'open', row: tab('b') })
    expect(next.temporary.map((r) => r.id)).toEqual(['b', 'a'])
  })

  it('pins, folders and unpins the same tab', () => {
    let state = space([folder('f')], [tab('a')])
    state = must(state, {
      type: 'move',
      id: 'a',
      to: { area: 'pinned', folderId: 'f', before: null },
    })
    expect(locate(state, 'a')).toEqual({ area: 'pinned', folderId: 'f', index: 0 })
    state = must(state, { type: 'move', id: 'a', to: { area: 'temporary', before: null } })
    expect(locate(state, 'a')?.area).toBe('temporary')
  })

  it('never nests folders or puts them in the temporary area', () => {
    const state = space([folder('f'), folder('g')])
    expect(
      apply(state, { type: 'move', id: 'f', to: { area: 'pinned', folderId: 'g', before: null } }),
    ).toBeNull()
    expect(
      apply(state, { type: 'move', id: 'f', to: { area: 'temporary', before: null } }),
    ).toBeNull()
  })

  it('deleting a folder keeps its rows in its place', () => {
    const state = space([tab('x'), folder('f', [tab('a'), tab('b')]), tab('y')])
    const next = must(state, { type: 'deleteFolder', id: 'f' })
    expect(next.pinned.map((e) => e.id)).toEqual(['x', 'a', 'b', 'y'])
  })

  it('splits two tabs into one row where the target was, then grows to four', () => {
    let state = space([], [tab('a'), tab('b'), tab('c'), tab('d'), tab('e')])
    state = must(state, { type: 'split', source: 'a', target: 'c', edge: 'left' })
    expect(rows(state)).toHaveLength(4)
    const split = state.temporary[1]
    expect(split.kind === 'split' && split.tabs.map((t) => t.id)).toEqual(['a', 'c'])
    state = must(state, { type: 'split', source: 'b', target: split.id, edge: 'right' })
    state = must(state, { type: 'split', source: 'd', target: split.id, edge: 'right' })
    expect(apply(state, { type: 'split', source: 'e', target: split.id, edge: 'right' })).toBeNull()
    // A vertical edge on a horizontal split is refused rather than guessed.
    expect(apply(state, { type: 'split', source: 'e', target: split.id, edge: 'top' })).toBeNull()
  })

  it('refuses to split a split into another row', () => {
    let state = space([], [tab('a'), tab('b'), tab('c')])
    state = must(state, { type: 'split', source: 'a', target: 'b', edge: 'right' })
    const splitId = state.temporary[0].id
    expect(apply(state, { type: 'split', source: splitId, target: 'c', edge: 'left' })).toBeNull()
  })

  it('detaching keeps the tab next to its former split and dissolves a pair', () => {
    let state = space([], [tab('a'), tab('b')])
    state = must(state, { type: 'split', source: 'a', target: 'b', edge: 'right' })
    state = must(state, { type: 'detach', tabId: 'a' })
    expect(state.temporary.map((r) => [r.kind, r.id])).toEqual([
      ['tab', 'b'],
      ['tab', 'a'],
    ])
  })

  it('removing a split member closes only that tab', () => {
    let state = space([], [tab('a'), tab('b'), tab('c')])
    state = must(state, { type: 'split', source: 'a', target: 'b', edge: 'right' })
    state = must(state, {
      type: 'split',
      source: 'c',
      target: state.temporary[0].id,
      edge: 'right',
    })
    state = must(state, { type: 'remove', id: 'b' })
    const split = state.temporary[0]
    expect(split.kind === 'split' && split.tabs.map((t) => t.id)).toEqual(['a', 'c'])
    expect(split.kind === 'split' && split.sizes).toHaveLength(2)
  })

  it('leaves the space untouched on an unknown target', () => {
    const state = space([], [tab('a')])
    expect(
      apply(state, { type: 'move', id: 'a', to: { area: 'temporary', before: 'zzz' } }),
    ).toBeNull()
    expect(state.temporary).toHaveLength(1)
  })

  it('renames tabs and folders, refusing empty folder names', () => {
    let state = space([folder('f', [tab('a')])])
    state = must(state, { type: 'updateTab', tabId: 'a', patch: { title: 'prod' } })
    expect(tabs(state)[0].title).toBe('prod')
    expect(apply(state, { type: 'renameFolder', id: 'f', name: '  ' })).toBeNull()
  })
})
