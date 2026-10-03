import { onScopeDispose } from 'vue'
import { on } from '@/ipc/events'
import type { Id, SessionStateEvent } from '@/ipc/types'
import { decodeBase64 } from '@/lib/base64'
import { SessionRouting } from '@/lib/session-routing'
import { terminals } from '@/terminal/registry'
import type { TabRuntime, TabState } from './sessions'

type EndedListener = (tabId: Id, event: SessionStateEvent) => void
type HostSavedListener = (tabId: Id, hostId: Id) => void

/**
 * Native session events applied to tab runtimes, in order. `SessionRouting`
 * delivers an event only while its session is bound to the tab; a runtime is
 * updated only while it still shows that session.
 */
export function createSessionEvents(
  runtimes: Record<Id, TabRuntime>,
  liveStates: readonly TabState[],
) {
  const routing = new SessionRouting()
  const endedListeners = new Set<EndedListener>()
  const hostSavedListeners = new Set<HostSavedListener>()
  function onEnded(listener: EndedListener): () => void {
    endedListeners.add(listener)
    return () => endedListeners.delete(listener)
  }

  /** A quick session saved its host, including notifications before open returns. */
  function onHostSaved(listener: HostSavedListener): () => void {
    hostSavedListeners.add(listener)
    return () => hostSavedListeners.delete(listener)
  }

  function runtimeOf(tabId: Id, sessionId: Id): TabRuntime | undefined {
    const current = runtimes[tabId]
    return current?.sessionId === sessionId ? current : undefined
  }

  function applyState(tabId: Id, event: SessionStateEvent) {
    const current = runtimeOf(tabId, event.sessionId)
    if (!current) return
    Object.assign(current, { state: event.state, message: event.message, exitCode: event.exitCode })
    if (!liveStates.includes(event.state)) {
      current.prompt = null
      routing.finish(event.sessionId)
      endedListeners.forEach((listener) => listener(tabId, event))
    }
  }

  const stopHostSaved = on('vault-changed', ({ sessionId, hostId }) => {
    if (!hostId) return
    routing.route(sessionId, (tabId) =>
      hostSavedListeners.forEach((listener) => listener(tabId, hostId)),
    )
  })
  const stopState = on('session-state', (event) =>
    routing.route(event.sessionId, (tabId) => applyState(tabId, event)),
  )
  const stopOutput = on('terminal-output', ({ sessionId, dataBase64 }) => {
    const bytes = decodeBase64(dataBase64)
    routing.route(sessionId, (tabId) => terminals.feed(tabId, bytes))
  })
  const stopPrompt = on('session-prompt', ({ sessionId, promptId, prompt }) =>
    routing.route(sessionId, (tabId) => {
      const current = runtimeOf(tabId, sessionId)
      if (!current) return
      if (prompt) current.prompt = { id: promptId, prompt }
      else if (current.prompt?.id === promptId) current.prompt = null
    }),
  )

  onScopeDispose(() => {
    stopState()
    stopOutput()
    stopPrompt()
    stopHostSaved()
    endedListeners.clear()
    hostSavedListeners.clear()
  })

  return { routing, onEnded, onHostSaved }
}
