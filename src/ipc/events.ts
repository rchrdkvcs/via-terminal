import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isNative } from './client'
import type {
  SessionPromptEvent,
  SessionStateEvent,
  TerminalOutputEvent,
  VaultChangedEvent,
} from './types'

interface EventMap {
  'terminal-output': TerminalOutputEvent
  'session-state': SessionStateEvent
  'session-prompt': SessionPromptEvent
  'vault-changed': VaultChangedEvent
}

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void

/**
 * One native listener per event name, fanned out in JavaScript.
 * `terminal-output` fires continuously while a shell streams, so registering
 * a native listener per pane would multiply the cost of every chunk.
 */
const subscribers = new Map<keyof EventMap, Set<Handler<never>>>()
const natives = new Map<keyof EventMap, Promise<UnlistenFn>>()

export function on<K extends keyof EventMap>(name: K, handler: Handler<K>): () => void {
  let handlers = subscribers.get(name) as Set<Handler<K>> | undefined
  if (!handlers) {
    handlers = new Set()
    subscribers.set(name, handlers as Set<Handler<never>>)
  }
  handlers.add(handler)

  if (isNative() && !natives.has(name)) {
    natives.set(
      name,
      listen<EventMap[K]>(name, ({ payload }) => {
        for (const subscriber of (subscribers.get(name) ?? []) as Set<Handler<K>>) {
          subscriber(payload)
        }
      }),
    )
  }
  return () => handlers.delete(handler)
}

/** Test seam: deliver an event as if Rust had emitted it. */
export function emitLocally<K extends keyof EventMap>(name: K, payload: EventMap[K]): void {
  for (const subscriber of (subscribers.get(name) ?? []) as Set<Handler<K>>) subscriber(payload)
}
