import { describe, expect, it } from 'vitest'
import type { Target } from '@/ipc/types'
import { findTab, rows, tabs } from '@/domain/space'
import { mocks, row, setup, split, target } from './workbench.fixture'

describe('workbench opening and moving tabs', () => {
  it('leaves organization, sessions and focus intact when an operation is rejected', () => {
    const { spaces, workbench } = setup([row('pinned')], [row('temporary')])
    workbench.activate('temporary', { wake: false })
    mocks.live.add('temporary')
    const before = JSON.stringify(spaces.spaces)
    expect(workbench.moveRow('temporary', 'missing')).toBe(false)
    expect(workbench.moveRow('temporary', 'one')).toBe(false)
    expect(workbench.closeTab('missing')).toBeUndefined()
    expect(workbench.removeSpace('missing')).toBe(false)
    expect(workbench.replace('missing', target)).toBeUndefined()
    expect(workbench.detach('temporary')).toBe(false)
    expect(workbench.splitWith('temporary', 'missing')).toBe(false)
    expect(JSON.stringify(spaces.spaces)).toBe(before)
    expect(workbench.activeTab?.id).toBe('temporary')
    expect(mocks.stop).not.toHaveBeenCalled()
    expect(mocks.release).not.toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
  })

  it('moves a split together with its sessions and repairs source focus', () => {
    const { spaces, workbench } = setup([], [split('split', ['left', 'right']), row('neighbor')])
    workbench.activate('left', { wake: false })
    mocks.live.add('left')
    mocks.live.add('right')
    expect(workbench.moveRow('right', 'two')).toBe(true)
    expect(tabs(spaces.byId('one')!).map((tab) => tab.id)).toEqual(['neighbor'])
    expect(tabs(spaces.byId('two')!).map((tab) => tab.id)).toEqual(['left', 'right'])
    expect(workbench.focused.one).toBe('neighbor')
    expect(workbench.activeTab?.id).toBe('right')
    expect(mocks.stop).not.toHaveBeenCalled()
    expect(mocks.release).not.toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    expect([...mocks.live]).toEqual(['left', 'right'])
  })

  it('retargets the actual owning space before stopping and restarting its session', () => {
    const { spaces, workbench } = setup([row('first')], [], [row('second')])
    workbench.activate('first', { wake: false })
    const replacement: Target = { kind: 'host', hostId: 'host' }
    mocks.stop.mockImplementation((id: string) => {
      expect(findTab(spaces.byId('two')!, id)?.target).toEqual(replacement)
      mocks.live.delete(id)
    })
    expect(workbench.replace('second', replacement)).toBe('second')
    expect(findTab(spaces.byId('one')!, 'first')?.target).toEqual(target)
    expect(workbench.activeTab?.id).toBe('second')
    expect(mocks.start).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'second', target: replacement }),
      'second-shell',
    )
  })

  it.each([split('full', ['a', 'b', 'c', 'd']), split('vertical', ['a', 'b'], 'vertical')])(
    'rejects a new split without creating or starting an orphan tab ($id)',
    (anchor) => {
      const { spaces, workbench } = setup([], [anchor])
      workbench.activate('a', { wake: false })
      const before = JSON.stringify(spaces.spaces)
      expect(workbench.openBeside(target, 'a')).toBeUndefined()
      expect(JSON.stringify(spaces.spaces)).toBe(before)
      expect(workbench.activeTab?.id).toBe('a')
      expect(mocks.start).not.toHaveBeenCalled()
      expect(mocks.release).not.toHaveBeenCalled()
    },
  )

  it('commits the split in the anchor space before opening the new session', () => {
    const { spaces, workbench } = setup([row('first')], [], [row('anchor')])
    workbench.activate('first', { wake: false })
    mocks.start.mockImplementation((tab: { id: string }) => {
      const owning = spaces.spaceOf(tab.id)!
      expect(owning.id).toBe('two')
      expect(rows(owning)[0].kind).toBe('split')
      expect(tabs(owning).map((tab) => tab.id)).toContain('anchor')
    })
    const id = workbench.openBeside(target, 'anchor')
    expect(id).toBeDefined()
    expect(workbench.activeTab?.id).toBe(id)
    expect(mocks.start).toHaveBeenCalledWith(expect.objectContaining({ id }), 'second-shell')
  })
})
