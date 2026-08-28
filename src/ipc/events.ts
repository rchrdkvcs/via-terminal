import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { isNative } from './client'
import type { SessionExitedEvent, SshStateChangedEvent, TerminalOutputEvent } from './types'

interface EventMap {
  'terminal-output': TerminalOutputEvent
  'ssh-state-changed': SshStateChangedEvent
  'session-exited': SessionExitedEvent
  'app-lock-changed': boolean
}

type AnyHandler = (payload: never) => void

/**
 * One native listener per event name, fanned out to local subscribers.
 *
 * Registering `listen()` inside each component multiplies the per-message cost
 * by the number of mounted components. `terminal-output` fires continuously
 * while a shell streams, so the fan-out has to happen in JavaScript.
 */
const subscribers = new Map<keyof EventMap, Set<AnyHandler>>()
const natives = new Map<keyof EventMap, Promise<UnlistenFn>>()

export function on<K extends keyof EventMap>(
  name: K,
  handler: (payload: EventMap[K]) => void,
): () => void {
  let handlers = subscribers.get(name)
  if (!handlers) {
    handlers = new Set()
    subscribers.set(name, handlers)
  }
  handlers.add(handler as AnyHandler)

  if (isNative() && !natives.has(name)) {
    natives.set(
      name,
      listen<EventMap[K]>(name, ({ payload }) => {
        const current = subscribers.get(name)
        if (!current) return
        for (const subscriber of current) (subscriber as (value: EventMap[K]) => void)(payload)
      }),
    )
  }

  return () => {
    subscribers.get(name)?.delete(handler as AnyHandler)
  }
}
