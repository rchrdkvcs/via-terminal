import { describe, expect, it, vi } from 'vitest'
import type { Size } from '@/ipc/types'
import { deferred, mocks, output, prompt, size, state, tab } from './sessions.fixture'
import { useSessions } from './sessions'
import { useSpaces } from './spaces'

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

describe('session events', () => {
  it('does not replay output queued after an early terminal state', async () => {
    const native = deferred<string>()
    mocks.openLocal.mockReturnValue(native.promise)
    const sessions = useSessions()
    const ended = vi.fn()
    sessions.onEnded(ended)
    const opening = sessions.start(tab, null)
    await Promise.resolve()
    state('ended', 'exited')
    output('ended')
    prompt('ended')
    state('ended', 'ready')
    native.resolve('ended')
    await opening
    expect(ended).toHaveBeenCalledTimes(1)
    expect(mocks.feed).not.toHaveBeenCalled()
    expect(sessions.runtime(tab.id).state).toBe('exited')
    expect(sessions.runtime(tab.id).prompt).toBeNull()
  })

  it('routes host-saved notifications received before open returns and ignores obsolete sessions', async () => {
    const native = deferred<string>()
    mocks.openLocal.mockReturnValue(native.promise)
    const sessions = useSessions()
    const saved = vi.fn()
    const unsubscribe = sessions.onHostSaved(saved)
    const opening = sessions.start(tab, null)
    await Promise.resolve()
    const hostSaved = mocks.handlers.get('vault-changed')!
    hostSaved({ sessionId: 'new', hostId: 'host' } as never)
    expect(saved).not.toHaveBeenCalled()
    native.resolve('new')
    await opening
    expect(saved).toHaveBeenCalledExactlyOnceWith('tab', 'host')
    sessions.stop(tab.id)
    hostSaved({ sessionId: 'new', hostId: 'late-host' } as never)
    expect(saved).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('drops early host-saved notifications for an invalidated opening', async () => {
    const native = deferred<string>()
    mocks.openLocal.mockReturnValue(native.promise)
    const sessions = useSessions()
    const saved = vi.fn()
    sessions.onHostSaved(saved)
    const opening = sessions.start(tab, null)
    await Promise.resolve()
    mocks.handlers.get('vault-changed')!({ sessionId: 'old', hostId: 'host' } as never)
    sessions.release(tab.id)
    native.resolve('old')
    await opening
    expect(saved).not.toHaveBeenCalled()
  })
})

describe('terminal input', () => {
  function hydrate() {
    useSpaces().hydrate({
      activeSpaceId: 'space',
      sidebar: { visible: true, width: 264 },
      spaces: [
        {
          id: 'space',
          name: 'Space',
          icon: 'terminal',
          defaultShell: 'space-shell',
          pinned: [{ kind: 'tab', ...tab }],
        },
      ],
    })
  }

  it('writes to a ready session and drops input otherwise', async () => {
    mocks.openLocal.mockResolvedValue('live')
    const sessions = useSessions()
    sessions.input(tab.id, 'ls')
    await sessions.start(tab, null)
    sessions.input(tab.id, 'ls')
    state('live', 'ready')
    sessions.input(tab.id, 'ls')
    sessions.input(tab.id, '\r')
    expect(mocks.write.mock.calls).toEqual([
      ['live', 'ls'],
      ['live', '\r'],
    ])
  })

  it.each(['exited', 'disconnected', 'failed'] as const)(
    'reconnects a %s tab on Enter with its space default shell',
    async (ended) => {
      hydrate()
      mocks.openLocal.mockResolvedValueOnce('old').mockResolvedValueOnce('new')
      const sessions = useSessions()
      await sessions.start(tab, null)
      state('old', ended)
      sessions.input(tab.id, 'x')
      expect(mocks.openLocal).toHaveBeenCalledTimes(1)
      sessions.input(tab.id, '\r')
      await vi.waitFor(() => expect(sessions.runtime(tab.id).sessionId).toBe('new'))
      expect(mocks.openLocal).toHaveBeenLastCalledWith('space-shell', null, size)
      expect(mocks.write).not.toHaveBeenCalled()
    },
  )

  it('leaves an asleep tab asleep on Enter', () => {
    hydrate()
    const sessions = useSessions()
    sessions.input(tab.id, '\r')
    expect(sessions.runtime(tab.id).state).toBe('asleep')
    expect(mocks.openLocal).not.toHaveBeenCalled()
  })
})
