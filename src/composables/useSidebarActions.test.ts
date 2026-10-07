import { describe, expect, it, vi } from 'vitest'
import { row, setup, split } from '@/stores/workbench.fixture'
import type { Row } from '@/ipc/types'
import { findTab, locate, rowOfTab, tabs } from '@/domain/space'
import { useVault } from '@/stores/vault'
import { useSidebarActions } from './useSidebarActions'

const folder = (id: string, rows: Row[] = []): Row =>
  ({ kind: 'folder', id, name: id, open: true, rows }) as unknown as Row

function sidebar() {
  const state = setup(
    [row('p1'), folder('f', [row('inner')]), row('p2')],
    [row('t1'), row('t2'), row('t3')],
  )
  return { ...state, actions: useSidebarActions() }
}

const order = (list: { id: string }[]) => list.map((entry) => entry.id)

describe('sidebar moves', () => {
  it('drops a row before or after another one, across areas', () => {
    const { spaces, actions } = sidebar()
    actions.dropOnRow('t3', 't1', 'before')
    expect(order(spaces.active.temporary)).toEqual(['t3', 't1', 't2'])
    actions.dropOnRow('t1', 'p1', 'after')
    expect(order(spaces.active.pinned)).toEqual(['p1', 't1', 'f', 'p2'])
    expect(order(spaces.active.temporary)).toEqual(['t3', 't2'])
  })

  it('drops into a folder, and only a folder accepts rows inside', () => {
    const { spaces, actions } = sidebar()
    actions.dropOnRow('t1', 'f', 'into')
    expect(locate(spaces.active, 't1')).toMatchObject({ area: 'pinned', folderId: 'f' })
    const before = JSON.stringify(spaces.active)
    actions.dropOnRow('t2', 'p1', 'into')
    actions.dropOnRow('t2', 'missing', 'before')
    expect(JSON.stringify(spaces.active)).toBe(before)

    actions.dropInFolder('p2', 'f')
    expect(order(spaces.active.pinned)).toEqual(['p1', 'f'])
    expect(locate(spaces.active, 'p2')).toMatchObject({ folderId: 'f' })
  })

  it('drops at either end of an area', () => {
    const { spaces, actions } = sidebar()
    actions.dropAtEnd('t1', 'pinned')
    expect(order(spaces.active.pinned)).toEqual(['p1', 'f', 'p2', 't1'])
    actions.dropAtEnd('p1', 'temporary')
    expect(order(spaces.active.temporary)).toEqual(['t2', 't3', 'p1'])
    actions.dropAtStart('inner')
    expect(order(spaces.active.temporary)).toEqual(['inner', 't2', 't3', 'p1'])
  })

  it('splits a dropped tab with the active one, never with itself', () => {
    const { spaces, workbench, actions } = sidebar()
    workbench.activate('t1', { wake: false })
    actions.splitWithActive('t1', 'right')
    expect(rowOfTab(spaces.active, 't1')?.kind).toBe('tab')

    actions.splitWithActive('t2', 'left')
    const joined = rowOfTab(spaces.active, 't1')!
    expect(joined).toBe(rowOfTab(spaces.active, 't2'))
    expect(joined.kind === 'split' && joined.tabs.map((tab) => tab.id)).toEqual(['t2', 't1'])
    expect(workbench.activeTab?.id).toBe('t2')
  })

  it('creates an open, empty folder at the end of the pinned area', () => {
    const { spaces, actions } = sidebar()
    const id = actions.newFolder()
    expect(spaces.active.pinned[spaces.active.pinned.length - 1]).toEqual({
      kind: 'folder',
      id,
      name: 'Nouveau dossier',
      open: true,
      rows: [],
    })
  })
})

describe('sidebar rename', () => {
  it('trims the title and clears it when left empty', () => {
    const { spaces, actions } = sidebar()
    actions.rename('t1', '  logs  ')
    expect(findTab(spaces.active, 't1')?.title).toBe('logs')
    actions.rename('t1', '   ')
    expect(findTab(spaces.active, 't1')?.title).toBeNull()
  })

  it('names an unnamed vault host instead of the tab', () => {
    const { spaces } = setup([], [split('pair', ['named', 'unnamed'])])
    const pair = spaces.active.temporary[0]
    if (pair.kind !== 'split') throw new Error('expected a split')
    pair.tabs[0].target = { kind: 'host', hostId: 'a' }
    pair.tabs[1].target = { kind: 'host', hostId: 'b' }
    pair.tabs[1].title = 'old'
    const vault = useVault()
    vault.hydrate({
      ...vault.view,
      hosts: [
        { id: 'a', label: 'Alpha', address: 'a.example' },
        { id: 'b', label: 'b.example', address: 'b.example' },
      ] as never,
      revision: 0,
    })
    const rename = vi.spyOn(vault, 'rename').mockResolvedValue('b')
    const sidebar = useSidebarActions()

    sidebar.rename('unnamed', ' Beta ')
    expect(rename).toHaveBeenCalledWith('b', 'Beta')
    expect(findTab(spaces.active, 'unnamed')?.title).toBeNull()

    sidebar.rename('named', 'Gamma')
    expect(rename).toHaveBeenCalledOnce()
    expect(findTab(spaces.active, 'named')?.title).toBe('Gamma')
    expect(tabs(spaces.active)).toHaveLength(2)
  })
})
