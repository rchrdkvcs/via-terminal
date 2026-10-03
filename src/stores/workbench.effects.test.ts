import { describe, expect, it } from 'vitest'
import type { SessionStateEvent } from '@/ipc/types'
import { findTab } from '@/domain/space'
import { mocks, row, setup } from './workbench.fixture'

describe('workbench reactions to sessions', () => {
  it('owns successful temporary shell exit cleanup and keeps pinned tabs', () => {
    const { spaces, workbench } = setup([row('pinned')], [row('temporary')])
    workbench.activate('temporary', { wake: false })
    const ended = mocks.onEnded.mock.calls[0][0] as (id: string, event: SessionStateEvent) => void
    const event: SessionStateEvent = {
      sessionId: 'session',
      state: 'exited',
      exitCode: 0,
      message: null,
    }
    ended('temporary', event)
    expect(findTab(spaces.active, 'temporary')).toBeUndefined()
    expect(workbench.activeTab?.id).toBe('pinned')
    ended('pinned', event)
    expect(findTab(spaces.active, 'pinned')).toBeDefined()
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith('temporary')
  })

  it('unregisters its session reactions when the workbench store is disposed', () => {
    const { workbench } = setup()
    expect(mocks.onEnded).toHaveBeenCalledTimes(1)
    expect(mocks.onHostSaved).toHaveBeenCalledTimes(1)
    workbench.$dispose()
    expect(mocks.stopEnded).toHaveBeenCalledTimes(1)
    expect(mocks.stopHostSaved).toHaveBeenCalledTimes(1)
  })

  it('retargets a saved quick host in its owning space without restarting the session', () => {
    const quick = row('quick')
    quick.target = { kind: 'quick', address: 'host', port: null, username: null }
    const { spaces, workbench } = setup([row('first')], [], [quick])
    workbench.activate('first', { wake: false })
    mocks.live.add('quick')
    const saved = mocks.onHostSaved.mock.calls[0][0] as (tabId: string, hostId: string) => void
    saved('quick', 'saved-host')
    expect(findTab(spaces.byId('two')!, 'quick')?.target).toEqual({
      kind: 'host',
      hostId: 'saved-host',
    })
    expect(workbench.activeTab?.id).toBe('first')
    expect(mocks.stop).not.toHaveBeenCalled()
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.live.has('quick')).toBe(true)
  })
})
