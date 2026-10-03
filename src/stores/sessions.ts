import { defineStore } from 'pinia'
import { onScopeDispose, reactive } from 'vue'
import { api, describeError } from '@/ipc/client'
import type { Id, Prompt, PromptAnswer, SessionState, Tab } from '@/ipc/types'
import { terminals } from '@/terminal/registry'
import { createSessionEvents } from './session-events'

export type TabState = SessionState | 'asleep'

export interface TabRuntime {
  sessionId: Id | null
  state: TabState
  message: string | null
  exitCode: number | null
  prompt: { id: Id; prompt: Prompt } | null
  /** Title reported by the terminal (OSC 0/2), used unless the tab is renamed. */
  autoTitle: string | null
}

const asleep = (): TabRuntime => ({
  sessionId: null,
  state: 'asleep',
  message: null,
  exitCode: null,
  prompt: null,
  autoTitle: null,
})

export const LIVE: readonly TabState[] = ['connecting', 'verifying', 'authenticating', 'ready']

/**
 * Live sessions per tab. Output and renderers are keyed by tab, so a
 * reconnection replaces the session while the scrollback stays in place.
 */
export const useSessions = defineStore('sessions', () => {
  const runtimes = reactive<Record<Id, TabRuntime>>({})
  const { routing, onEnded, onHostSaved } = createSessionEvents(runtimes, LIVE)
  // Only the latest opening attempt may attach a native session to its tab.
  const openings = new Map<Id, symbol>()

  function runtime(tabId: Id): TabRuntime {
    return runtimes[tabId] ?? asleep()
  }

  function isLive(tabId: Id): boolean {
    return LIVE.includes(runtime(tabId).state)
  }

  async function start(tab: Tab, defaultShell: string | null) {
    if (isLive(tab.id)) return
    const attempt = Symbol()
    openings.set(tab.id, attempt)
    const target = tab.target
    runtimes[tab.id] = {
      ...asleep(),
      autoTitle: runtimes[tab.id]?.autoTitle ?? null,
      state: 'connecting',
    }
    try {
      const size = await terminals.measure(tab.id)
      if (openings.get(tab.id) !== attempt) return
      const sessionId =
        target.kind === 'local'
          ? await api.session.openLocal(target.shell ?? defaultShell, target.cwd, size)
          : target.kind === 'host'
            ? await api.session.openHost(target.hostId, size)
            : await api.session.openQuick(target, size)
      if (openings.get(tab.id) !== attempt) {
        close(sessionId)
        return
      }
      // The id goes on the tab first: early events are checked against it.
      runtimes[tab.id].sessionId = sessionId
      routing.bind(sessionId, tab.id)
    } catch (cause) {
      if (openings.get(tab.id) === attempt)
        Object.assign(runtimes[tab.id], { state: 'failed', message: describeError(cause) })
    } finally {
      if (openings.get(tab.id) === attempt) openings.delete(tab.id)
    }
  }

  function close(sessionId: Id) {
    routing.finish(sessionId)
    void api.session.close(sessionId).catch(() => undefined)
  }

  function stop(tabId: Id) {
    openings.delete(tabId)
    const sessionId = runtimes[tabId]?.sessionId
    if (sessionId) close(sessionId)
    if (runtimes[tabId])
      Object.assign(runtimes[tabId], { ...asleep(), autoTitle: runtimes[tabId].autoTitle })
  }

  /** Stop and forget everything about a tab, renderer included. */
  function release(tabId: Id) {
    stop(tabId)
    delete runtimes[tabId]
    terminals.release(tabId)
  }

  function write(tabId: Id, data: string) {
    const sessionId = runtimes[tabId]?.sessionId
    if (sessionId && runtime(tabId).state === 'ready') {
      void api.session.write(sessionId, data).catch(() => undefined)
    }
  }

  function resize(tabId: Id, cols: number, rows: number) {
    const sessionId = runtimes[tabId]?.sessionId
    if (sessionId) void api.session.resize(sessionId, { cols, rows }).catch(() => undefined)
  }

  async function answer(tabId: Id, reply: PromptAnswer) {
    const prompt = runtimes[tabId]?.prompt
    if (!prompt) return
    runtimes[tabId].prompt = null
    await api.session.answer(prompt.id, reply).catch(() => undefined)
  }

  function setAutoTitle(tabId: Id, title: string) {
    if (runtimes[tabId] && title) runtimes[tabId].autoTitle = title.slice(0, 200)
  }

  onScopeDispose(() => Object.keys(runtimes).forEach(release))

  /** The tab a session belongs to, while it is live. */
  function tabOf(sessionId: Id): Id | undefined {
    return routing.tabOf(sessionId)
  }

  return {
    runtime,
    isLive,
    start,
    stop,
    release,
    write,
    resize,
    answer,
    setAutoTitle,
    onEnded,
    onHostSaved,
    tabOf,
  }
})
