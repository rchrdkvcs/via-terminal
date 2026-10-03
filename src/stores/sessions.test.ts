import { describe, expect, it, vi } from 'vitest'
import type { Size } from '@/ipc/types'
import { deferred, mocks, output, prompt, size, state, tab } from './sessions.fixture'
import { useSessions } from './sessions'

describe('session opening lifecycle', () => {
  it.each(['stop', 'release'] as const)(
    'does not open after %s during measurement',
    async (end) => {
      const measurement = deferred<Size>()
      mocks.measure.mockReturnValue(measurement.promise)
      const sessions = useSessions()
      const opening = sessions.start(tab, null)
      sessions[end](tab.id)
      measurement.resolve(size)
      await opening
      expect(mocks.openLocal).not.toHaveBeenCalled()
      expect(sessions.runtime(tab.id).state).toBe('asleep')
      if (end === 'release') expect(mocks.release).toHaveBeenCalledWith(tab.id)
    },
  )

  it.each(['stop', 'release'] as const)(
    'closes a session returned after %s and drops its events',
    async (end) => {
      const native = deferred<string>()
      mocks.openLocal.mockReturnValue(native.promise)
      const sessions = useSessions()
      const ended = vi.fn()
      sessions.onEnded(ended)
      const opening = sessions.start(tab, null)
      await Promise.resolve()
      sessions[end](tab.id)
      state('old', 'ready')
      output('old')
      prompt('old')
      native.resolve('old')
      await opening
      state('old', 'failed')
      output('old')
      prompt('old')
      expect(mocks.close).toHaveBeenCalledExactlyOnceWith('old')
      expect(mocks.feed).not.toHaveBeenCalled()
      expect(ended).not.toHaveBeenCalled()
      expect(sessions.runtime(tab.id)).toMatchObject({
        state: 'asleep',
        sessionId: null,
        prompt: null,
      })
      expect(sessions.tabOf('old')).toBeUndefined()
    },
  )

  it('keeps a replacement opening intact when the old session returns', async () => {
    const old = deferred<string>()
    const replacement = deferred<string>()
    mocks.openLocal.mockReturnValueOnce(old.promise).mockReturnValueOnce(replacement.promise)
    const sessions = useSessions()
    const first = sessions.start(tab, null)
    await Promise.resolve()
    sessions.stop(tab.id)
    const second = sessions.start(tab, null)
    await Promise.resolve()
    state('new', 'ready')
    output('new')
    prompt('new')
    replacement.resolve('new')
    await second
    state('old', 'ready')
    output('old')
    old.resolve('old')
    await first
    state('old', 'failed')
    prompt('old')
    expect(sessions.runtime(tab.id)).toMatchObject({
      state: 'ready',
      sessionId: 'new',
      prompt: { id: 'prompt' },
    })
    expect(sessions.tabOf('new')).toBe(tab.id)
    expect(mocks.feed).toHaveBeenCalledTimes(1)
    expect(mocks.close).toHaveBeenCalledExactlyOnceWith('old')
  })

  it('ignores an obsolete opening error during a replacement attempt', async () => {
    const old = deferred<string>()
    const replacement = deferred<string>()
    mocks.openLocal.mockReturnValueOnce(old.promise).mockReturnValueOnce(replacement.promise)
    const sessions = useSessions()
    const first = sessions.start(tab, null)
    await Promise.resolve()
    sessions.release(tab.id)
    const second = sessions.start(tab, null)
    await Promise.resolve()
    old.reject(new Error('obsolete'))
    await first
    expect(sessions.runtime(tab.id)).toMatchObject({ state: 'connecting', message: null })
    replacement.resolve('new')
    await second
    expect(sessions.runtime(tab.id).sessionId).toBe('new')
  })

  it('reports measurement failures and permits retry', async () => {
    mocks.measure.mockRejectedValueOnce(new Error('measurement failed'))
    mocks.openLocal.mockResolvedValue('new')
    const sessions = useSessions()
    await sessions.start(tab, null)
    expect(sessions.runtime(tab.id)).toMatchObject({
      state: 'failed',
      message: 'measurement failed',
    })
    await sessions.start(tab, null)
    expect(sessions.runtime(tab.id).sessionId).toBe('new')
  })

  it('unregisters native events and stops the live session when disposed', async () => {
    mocks.openLocal.mockResolvedValue('live')
    const sessions = useSessions()
    await sessions.start(tab, null)
    state('live', 'ready')
    sessions.$dispose()
    expect(mocks.handlers.size).toBe(0)
    expect(mocks.close).toHaveBeenCalledExactlyOnceWith('live')
    expect(mocks.release).toHaveBeenCalledExactlyOnceWith(tab.id)
  })

  it('closes an opening returned after store disposal', async () => {
    const native = deferred<string>()
    mocks.openLocal.mockReturnValue(native.promise)
    const sessions = useSessions()
    const opening = sessions.start(tab, null)
    await Promise.resolve()
    sessions.$dispose()
    native.resolve('old')
    await opening
    expect(mocks.close).toHaveBeenCalledExactlyOnceWith('old')
    expect(sessions.tabOf('old')).toBeUndefined()
  })
})
