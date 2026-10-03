import { describe, expect, it, vi } from 'vitest'
import { findTab, rows, tabs } from '@/domain/space'
import { mocks, row, setup, split } from './workbench.fixture'

describe('workbench closing and space removal', () => {
  it('puts a live pinned tab to sleep without removing it or changing focus', () => {
    const { spaces, workbench } = setup([row('pinned')])
    workbench.activate('pinned', { wake: false })
    mocks.live.add('pinned')
    expect(workbench.closeTab('pinned')).toEqual({})
    expect(findTab(spaces.active, 'pinned')).toBeDefined()
    expect(workbench.activeTab?.id).toBe('pinned')
    expect(mocks.stop).toHaveBeenCalledExactlyOnceWith('pinned')
    expect(mocks.release).not.toHaveBeenCalled()
  })

  it('removes an asleep pinned tab and restores it with undo without waking it', () => {
    const { spaces, workbench } = setup([row('pinned'), row('neighbor')])
    workbench.activate('pinned', { wake: false })
    const result = workbench.closeTab('pinned')
    expect(findTab(spaces.active, 'pinned')).toBeUndefined()
    expect(workbench.activeTab?.id).toBe('neighbor')
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith('pinned')
    expect(result?.undo?.()).toBe(true)
    expect(result?.undo?.()).toBe(false)
    expect(rows(spaces.active).map((row) => row.id)).toEqual(['pinned', 'neighbor'])
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('removes a temporary split tab, selects its sibling and retains that session', () => {
    const { spaces, workbench } = setup([], [split('split', ['left', 'right'])])
    workbench.activate('left', { wake: false })
    mocks.live.add('right')
    expect(workbench.closeTab('left')).toEqual({})
    expect(rows(spaces.active).map((row) => row.id)).toEqual(['right'])
    expect(workbench.activeTab?.id).toBe('right')
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith('left')
    vi.advanceTimersByTime(0)
    expect(mocks.focus).toHaveBeenCalledExactlyOnceWith('right')
    expect(mocks.live.has('right')).toBe(true)
  })

  it('rejects the removal of the last space before releasing its sessions', () => {
    const { spaces, workbench } = setup([row('pinned')])
    spaces.remove('two')
    workbench.activate('pinned', { wake: false })
    mocks.live.add('pinned')
    expect(workbench.removeSpace('one')).toBe(false)
    expect(workbench.activeTab?.id).toBe('pinned')
    expect(spaces.byId('one')).toBeDefined()
    expect(mocks.release).not.toHaveBeenCalled()
  })

  it('removes a space, releases every tab and returns focus to the remaining space', () => {
    const { spaces, workbench } = setup(
      [row('pinned')],
      [split('split', ['a', 'b'])],
      [row('remaining')],
    )
    workbench.activate('remaining', { wake: false })
    workbench.activate('a', { wake: false })
    expect(workbench.removeSpace('one')).toBe(true)
    expect(spaces.byId('one')).toBeUndefined()
    expect(workbench.focused.one).toBeUndefined()
    expect(workbench.activeTab?.id).toBe('remaining')
    expect(mocks.release.mock.calls).toEqual([['pinned'], ['a'], ['b']])
  })

  it('cannot undo into a removed space', () => {
    const { spaces, workbench } = setup([row('pinned')])
    const result = workbench.closeTab('pinned')
    expect(workbench.removeSpace('one')).toBe(true)
    expect(result?.undo?.()).toBe(false)
    expect(tabs(spaces.active)).toEqual([])
  })
})
