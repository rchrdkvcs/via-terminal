import { describe, expect, it, vi } from 'vitest'
import { deferred, mocks, output, prompt, state, tab } from './sessions.fixture'
import { useSessions } from './sessions'

// Native events can arrive before `open` returns the session id they carry.
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
