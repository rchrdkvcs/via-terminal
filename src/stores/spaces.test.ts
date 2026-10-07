import { describe, expect, it } from 'vitest'
import type { Folder, Layout } from '@/ipc/types'
import { LAYOUT_LIMITS } from '@/domain/limits'
import { mocks, row, setup } from './workbench.fixture'

const folder = (id: string): Folder => ({ kind: 'folder', id, name: id, open: true, rows: [] })

describe('space switch direction', () => {
  it('follows the order of spaces when activating one', () => {
    const { spaces } = setup()
    spaces.activate('two')
    expect(spaces.switchDirection).toBe(1)
    spaces.activate('one')
    expect(spaces.switchDirection).toBe(-1)
  })

  it('keeps the cycling direction across the wrap-around', () => {
    const { spaces } = setup()
    spaces.cycle(-1)
    expect(spaces.activeId).toBe('two')
    expect(spaces.switchDirection).toBe(-1)
  })

  it('wraps forward from the last space, sliding in from the right', () => {
    const { spaces } = setup()
    spaces.activate('two')
    spaces.cycle(1)
    expect(spaces.activeId).toBe('one')
    expect(spaces.switchDirection).toBe(1)
  })

  it('stays put when there is no other space to swipe to', () => {
    const { spaces } = setup()
    spaces.remove('two')
    const before = spaces.activeId
    spaces.cycle(1)
    spaces.cycle(-1)
    expect(spaces.activeId).toBe(before)
  })
})

describe('layout persistence', () => {
  const invalid = { code: 'invalid', message: 'names must be between 1 and 80 characters' }
  const saved = () => mocks.saveLayout.mock.calls.map(([layout]) => layout as Layout)

  it('restores the last saved layout when one is rejected, so the next save succeeds', async () => {
    const { spaces } = setup([row('kept')], [row('loose')])
    mocks.saveLayout.mockRejectedValueOnce(invalid)
    spaces.dispatch({ type: 'createFolder', folder: folder('f'), before: null })
    spaces.dispatch({
      type: 'move',
      id: 'loose',
      to: { area: 'pinned', folderId: 'f', before: null },
    })
    await expect(spaces.flush()).rejects.toEqual(invalid)

    const one = spaces.byId('one')!
    expect(one.pinned.map((entry) => entry.id)).toEqual(['kept'])
    expect(one.temporary.map((entry) => entry.id)).toEqual(['loose'])

    spaces.activate('two')
    await spaces.flush()
    expect(saved()).toHaveLength(2)
    expect(saved()[1].activeSpaceId).toBe('two')
    expect(saved()[1].spaces[0].pinned.map((entry) => entry.id)).toEqual(['kept'])
  })

  it('keeps retrying the same changes after a transient storage failure', async () => {
    const { spaces } = setup()
    mocks.saveLayout.mockRejectedValueOnce({ code: 'storage', message: 'disk full' })
    spaces.dispatch({ type: 'createFolder', folder: folder('f'), before: null })
    await expect(spaces.flush()).rejects.toMatchObject({ code: 'storage' })
    expect(spaces.byId('one')!.pinned.map((entry) => entry.id)).toEqual(['f'])
    await spaces.flush()
    expect(saved()[1].spaces[0].pinned.map((entry) => entry.id)).toEqual(['f'])
  })

  it('refuses space names the layout would reject', () => {
    const { spaces } = setup()
    const draft = { icon: 'terminal', defaultShell: null }
    expect(spaces.create({ ...draft, name: 'x'.repeat(LAYOUT_LIMITS.nameLength + 1) })).toBeNull()
    spaces.update('one', { ...draft, name: '   ' })
    expect(spaces.byId('one')!.name).toBe('One')
    expect(spaces.spaces).toHaveLength(2)
  })

  it('keeps the sidebar width within the layout limits', () => {
    const { spaces } = setup()
    spaces.setSidebar({ width: 5000.4 })
    expect(spaces.sidebar.width).toBe(LAYOUT_LIMITS.sidebarWidth.max)
  })
})
