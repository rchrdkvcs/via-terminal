import { defineStore } from 'pinia'
import { onScopeDispose, reactive } from 'vue'
import { api, describeError } from '@/ipc/client'
import { on } from '@/ipc/events'
import type { Id, Prompt, PromptAnswer, SessionState, SessionStateEvent, Tab } from '@/ipc/types'
import { findTab } from '@/domain/space'
import { decodeBase64 } from '@/lib/base64'
import { SessionRouting } from '@/lib/session-routing'
import { terminals } from '@/terminal/registry'
import { useSpaces } from './spaces'

export type TabState = SessionState | 'asleep'

export interface TabRuntime {
  sessionId: Id | null
  state: TabState
  message: string | null
  exitCode: number | null
  prompt: { id: Id; prompt: Prompt } | null

  autoTitle: string | null
}

type EndedListener = (tabId: Id, event: SessionStateEvent) => void
type HostSavedListener = (tabId: Id, hostId: Id) => void

const asleep = (): TabRuntime => ({
  sessionId: null,
  state: 'asleep',
  message: null,
  exitCode: null,
  prompt: null,
  autoTitle: null,
})

const LIVE: readonly TabState[] = ['connecting', 'verifying', 'authenticating', 'ready']
const ENDED: readonly TabState[] = ['exited', 'disconnected', 'failed']
const ENTER = String.fromCharCode(13)

export const useSessions = defineStore('sessions', () => {
  const spaces = useSpaces()
  const runtimes = reactive<Record<Id, TabRuntime>>({})
  const routing = new SessionRouting()
  const openings = new Map<Id, symbol>()
  const endedListeners = new Set<EndedListener>()
  const hostSavedListeners = new Set<HostSavedListener>()

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
      // A tab showing files or a document opens no shell, so it has no terminal to size.
      const size = tab.view ? null : await terminals.measure(tab.id)
      if (openings.get(tab.id) !== attempt) return
      const sessionId =
        target.kind === 'local'
          ? await api.session.openLocal(
              target.shell ?? defaultShell,
              target.cwd,
              size ?? terminals.sizeFor(tab.id),
            )
          : target.kind === 'host'
            ? await api.session.openHost(target.hostId, size)
            : await api.session.openQuick(target, size)
      if (openings.get(tab.id) !== attempt) {
        close(sessionId)
        return
      }

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

  function release(tabId: Id) {
    stop(tabId)
    delete runtimes[tabId]
    terminals.release(tabId)
  }

  function input(tabId: Id, data: string) {
    const { sessionId, state } = runtime(tabId)
    if (data === ENTER && ENDED.includes(state)) {
      const space = spaces.spaceOf(tabId)
      const tab = space && findTab(space, tabId)
      if (tab) void start(tab, space.defaultShell)
    } else if (sessionId && state === 'ready') {
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

  function tabOf(sessionId: Id): Id | undefined {
    return routing.tabOf(sessionId)
  }

  function onEnded(listener: EndedListener): () => void {
    endedListeners.add(listener)
    return () => endedListeners.delete(listener)
  }

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
    if (!LIVE.includes(event.state)) {
      current.prompt = null
      routing.finish(event.sessionId)
      endedListeners.forEach((listener) => listener(tabId, event))
    }
  }

  const unsubscribe = [
    on('vault-changed', ({ sessionId, hostId }) => {
      if (!hostId) return
      routing.route(sessionId, (tabId) =>
        hostSavedListeners.forEach((listener) => listener(tabId, hostId)),
      )
    }),
    on('session-state', (event) =>
      routing.route(event.sessionId, (tabId) => applyState(tabId, event)),
    ),
    on('terminal-output', ({ sessionId, dataBase64 }) => {
      const bytes = decodeBase64(dataBase64)
      routing.route(sessionId, (tabId) => terminals.feed(tabId, bytes))
    }),
    on('session-prompt', ({ sessionId, promptId, prompt }) =>
      routing.route(sessionId, (tabId) => {
        const current = runtimeOf(tabId, sessionId)
        if (!current) return
        if (prompt) current.prompt = { id: promptId, prompt }
        else if (current.prompt?.id === promptId) current.prompt = null
      }),
    ),
  ]

  onScopeDispose(() => {
    unsubscribe.forEach((stop) => stop())
    endedListeners.clear()
    hostSavedListeners.clear()
    Object.keys(runtimes).forEach(release)
  })

  return {
    runtime,
    isLive,
    start,
    stop,
    release,
    input,
    resize,
    answer,
    setAutoTitle,
    onEnded,
    onHostSaved,
    tabOf,
  }
})
