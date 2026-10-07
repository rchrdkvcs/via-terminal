import { describe, expect, it } from 'vitest'
import type { Folder, Row } from '@/ipc/types'
import { LAYOUT_LIMITS } from './limits'
import { apply, transfer, type Intent } from './organize'
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
    defaultShell: null,
    pinned,
    temporary,
  }
}

function must(state: Space, intent: Intent): Space {
  const next = apply(state, intent)
  expect(next).not.toBeNull()

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

  it('applies several intents together, or none of them', () => {
    const state = space([], [tab('a'), tab('b')])
    const both = apply(state, [
      { type: 'updateTab', tabId: 'a', patch: { title: 'prod' } },
      { type: 'split', source: 'b', target: 'a', edge: 'right' },
    ])
    expect(both && rows(both).map((row) => row.kind)).toEqual(['split'])
    const rejected = apply(state, [
      { type: 'updateTab', tabId: 'a', patch: { title: 'prod' } },
      { type: 'remove', id: 'missing' },
    ])
    expect(rejected).toBeNull()
    expect(tabs(state)[0].title).toBeNull()
  })
})

describe('navigate', () => {
  const remote = (id: string, extra: Partial<Row>): Row =>
    ({ ...tab(id), target: { kind: 'host', hostId: 'h' }, ...extra }) as Row
  const cwd = (state: Space, id: string) => {
    const target = tabs(state).find((t) => t.id === id)!.target
    return target.kind === 'local' ? target.cwd : undefined
  }

  it('moves a temporary tab to the directory it navigated to', () => {
    const state = must(space([], [tab('a')]), {
      type: 'navigate',
      tabId: 'a',
      side: 'local',
      path: '/lab/src',
    })
    expect(cwd(state, 'a')).toBe('/lab/src')
  })

  it('never moves the pin of a pinned tab, even inside a folder or split', () => {
    const state = space([tab('a'), folder('f', [tab('b')])])
    for (const id of ['a', 'b']) {
      const next = must(state, { type: 'navigate', tabId: id, side: 'local', path: '/elsewhere' })
      expect(cwd(next, id)).toBeNull()
    }
    const split = must(space([tab('c'), tab('d')]), {
      type: 'split',
      source: 'd',
      target: 'c',
      edge: 'right',
    })
    const next = must(split, { type: 'navigate', tabId: 'd', side: 'local', path: '/elsewhere' })
    expect(cwd(next, 'd')).toBeNull()
  })

  it('follows the remote shell or the explorer path of a temporary remote tab', () => {
    const state = space([], [remote('t', {}), remote('e', { view: { kind: 'files', path: '/' } })])
    let next = must(state, { type: 'navigate', tabId: 't', side: 'remote', path: '/var/log' })
    next = must(next, { type: 'navigate', tabId: 'e', side: 'remote', path: '/etc' })
    const [terminal, explorer] = tabs(next)
    expect(terminal.remoteCwd).toBe('/var/log')
    expect(explorer.view).toEqual({ kind: 'files', path: '/etc' })
  })

  it('ignores directories that do not apply to the tab', () => {
    const doc = remote('d', { view: { kind: 'document', path: '/etc/hosts' } })
    const state = space([], [tab('a'), doc, remote('t', {})])
    expect(must(state, { type: 'navigate', tabId: 'd', side: 'remote', path: '/etc' })).toEqual(
      state,
    )
    expect(must(state, { type: 'navigate', tabId: 't', side: 'remote', path: '' })).toEqual(state)
    expect(must(state, { type: 'navigate', tabId: 't', side: 'local', path: '/x' })).toEqual(state)
    expect(apply(state, { type: 'navigate', tabId: 'zzz', side: 'local', path: '/x' })).toBeNull()
  })
})

describe('layout limits', () => {
  const { nameLength, titleLength } = LAYOUT_LIMITS

  it('refuses tab titles the layout would reject', () => {
    const state = space([], [tab('a')])
    const title = (value: string) =>
      apply(state, { type: 'updateTab', tabId: 'a', patch: { title: value } })
    expect(title('t'.repeat(titleLength))).not.toBeNull()
    expect(title('t'.repeat(titleLength + 1))).toBeNull()
    expect(title('   ')).toBeNull()
  })

  it('refuses folder names the layout would reject', () => {
    const state = space([folder('f')])
    const rename = (name: string) => apply(state, { type: 'renameFolder', id: 'f', name })
    expect(rename('n'.repeat(nameLength))).not.toBeNull()
    expect(rename('n'.repeat(nameLength + 1))).toBeNull()
    const long = { ...folder('g'), name: 'n'.repeat(nameLength + 1) }
    expect(apply(state, { type: 'createFolder', folder: long, before: null })).toBeNull()
  })

  it('refuses split views outside the allowed tab count', () => {
    const tooMany: Row = {
      kind: 'split',
      id: 'big',
      direction: 'horizontal',
      sizes: [1, 1, 1, 1, 1],
      tabs: ['a', 'b', 'c', 'd', 'e'].map((id) => ({
        id,
        title: null,
        target: { kind: 'local', shell: null, cwd: null },
      })),
    }
    expect(apply(space(), { type: 'open', row: tooMany })).toBeNull()
  })
})

describe('transfer', () => {
  it('moves a row to another space, keeping it pinned or temporary', () => {
    const from = space([tab('p')], [tab('t')])
    const to = { ...space(), id: 'other' }
    const [source, destination] = transfer(from, to, 'p')!
    expect(rows(source).map((row) => row.id)).toEqual(['t'])
    expect(locate(destination, 'p')?.area).toBe('pinned')
    const [, again] = transfer(from, to, 't')!
    expect(locate(again, 't')?.area).toBe('temporary')
  })

  it('refuses an unknown row or the same space', () => {
    const from = space([], [tab('t')])
    expect(transfer(from, { ...space(), id: 'other' }, 'missing')).toBeNull()
    expect(transfer(from, from, 't')).toBeNull()
  })
})
