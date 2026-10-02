import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { api, describeError } from '@/ipc/client'
import { on } from '@/ipc/events'
import type { Id, Prompt, PromptAnswer, SessionState, SessionStateEvent, Tab } from '@/ipc/types'
import { terminals } from '@/terminal/registry'
import { decodeBase64 } from '@/lib/base64'
import { SessionRouting } from '@/lib/session-routing'

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

type EndedListener = (tabId: Id, event: SessionStateEvent) => void

/**
 * Live sessions per tab. Output and renderers are keyed by tab, so a
 * reconnection replaces the session while the scrollback stays in place.
 */
export const useSessions = defineStore('sessions', () => {
  const runtimes = reactive<Record<Id, TabRuntime>>({})
  const routing = new SessionRouting()
  const endedListeners = new Set<EndedListener>()

  function runtime(tabId: Id): TabRuntime {
    return runtimes[tabId] ?? asleep()
  }

  function isLive(tabId: Id): boolean {
    return LIVE.includes(runtime(tabId).state)
  }

  async function start(tab: Tab, defaultShell: string | null) {
    if (isLive(tab.id)) return
    runtimes[tab.id] = {
      ...asleep(),
      autoTitle: runtimes[tab.id]?.autoTitle ?? null,
      state: 'connecting',
    }
    const size = await terminals.measure(tab.id)
    try {
      const target = tab.target
      const sessionId =
        target.kind === 'local'
          ? await api.session.openLocal(target.shell ?? defaultShell, target.cwd, size)
          : target.kind === 'host'
            ? await api.session.openHost(target.hostId, size)
            : await api.session.openQuick(target, size)
      // The id goes on the tab first: early events are checked against it.
      runtimes[tab.id].sessionId = sessionId
      routing.bind(sessionId, tab.id)
    } catch (cause) {
      Object.assign(runtimes[tab.id], { state: 'failed', message: describeError(cause) })
    }
  }

  function stop(tabId: Id) {
    const sessionId = runtimes[tabId]?.sessionId
    if (sessionId) {
      routing.finish(sessionId)
      void api.session.close(sessionId).catch(() => undefined)
    }
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

  function onEnded(listener: EndedListener): () => void {
    endedListeners.add(listener)
    return () => endedListeners.delete(listener)
  }

  function applyState(tabId: Id, event: SessionStateEvent) {
    const current = runtimes[tabId]
    if (!current || current.sessionId !== event.sessionId) return
    Object.assign(current, { state: event.state, message: event.message, exitCode: event.exitCode })
    if (!LIVE.includes(event.state)) {
      current.prompt = null
      routing.finish(event.sessionId)
      endedListeners.forEach((listener) => listener(tabId, event))
    }
  }

  on('session-state', (event) =>
    routing.route(event.sessionId, (tabId) => applyState(tabId, event)),
  )
  on('terminal-output', ({ sessionId, dataBase64 }) => {
    const bytes = decodeBase64(dataBase64)
    routing.route(sessionId, (tabId) => terminals.feed(tabId, bytes))
  })
  on('session-prompt', ({ sessionId, promptId, prompt }) =>
    routing.route(sessionId, (tabId) => {
      const current = runtimes[tabId]
      if (!current || current.sessionId !== sessionId) return
      if (prompt) current.prompt = { id: promptId, prompt }
      else if (current.prompt?.id === promptId) current.prompt = null
    }),
  )

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
    tabOf,
  }
})
