import { describe, expect, it } from 'vitest'
import type { Row } from '@/ipc/types'
import { findTab, isPinned, rows } from '@/domain/space'
import { row, setup } from './workbench.fixture'

const remote = (id: string): Extract<Row, { kind: 'tab' }> => ({
  ...row(id),
  target: { kind: 'host', hostId: 'host' },
})

describe('workbench views', () => {
  it('opens a document in a temporary tab right after its temporary source', () => {
    const { spaces, workbench } = setup([], [remote('source'), remote('other')])
    const id = workbench.openView(findTab(spaces.active, 'source')!, {
      kind: 'document',
      path: '/etc/hosts',
    })
    expect(rows(spaces.active).map((row) => row.id)).toEqual(['source', id, 'other'])
    const opened = findTab(spaces.active, id!)
    expect(opened?.view).toEqual({ kind: 'document', path: '/etc/hosts' })
    expect(opened?.target).toEqual({ kind: 'host', hostId: 'host' })
    expect(isPinned(spaces.active, id!)).toBe(false)
    expect(workbench.activeTab?.id).toBe(id)
  })

  it('never pins a view opened from a pinned tab', () => {
    const { spaces, workbench } = setup([remote('source')], [remote('other')])
    const id = workbench.openView(findTab(spaces.active, 'source')!, { kind: 'files', path: '/' })
    expect(isPinned(spaces.active, id!)).toBe(false)
    expect(spaces.active.temporary.map((row) => row.id)).toEqual([id, 'other'])
  })

  it('reuses the tab already showing the same document of the same target', () => {
    const { spaces, workbench } = setup([], [remote('source')])
    const source = findTab(spaces.active, 'source')!
    const view = { kind: 'document', path: '/etc/hosts' } as const
    const first = workbench.openView(source, view)
    workbench.activate('source', { wake: false })
    expect(workbench.openView(source, view)).toBe(first)
    expect(workbench.activeTab?.id).toBe(first)
    expect(workbench.openView(source, { kind: 'files', path: '/etc' })).not.toBe(first)
    expect(rows(spaces.active)).toHaveLength(3)
  })

  it('shows no view of a local shell', () => {
    const { spaces, workbench } = setup([], [row('local')])
    const local = findTab(spaces.active, 'local')!
    expect(workbench.openView(local, { kind: 'files', path: null })).toBeUndefined()
    expect(rows(spaces.active)).toHaveLength(1)
  })

  it('turns a view back into a terminal when its target changes', () => {
    const { spaces, workbench } = setup(
      [],
      [{ ...remote('tab'), view: { kind: 'files', path: '/' } }],
    )
    workbench.open({ kind: 'host', hostId: 'other' }, { replace: 'tab' })
    expect(findTab(spaces.active, 'tab')?.view).toBeUndefined()
  })
})
