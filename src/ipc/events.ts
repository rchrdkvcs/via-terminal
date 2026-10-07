import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import type { TransferEvent } from './files'
import { isNative } from './client'
import type {
  SessionPromptEvent,
  SessionStateEvent,
  TerminalOutputEvent,
  TrackpadSwipeEvent,
  VaultChangedEvent,
} from './types'

interface EventMap {
  'app-exit-requested': null
  'file-transfer': TransferEvent
  'terminal-output': TerminalOutputEvent
  'session-state': SessionStateEvent
  'session-prompt': SessionPromptEvent
  'vault-changed': VaultChangedEvent
  'trackpad-swipe': TrackpadSwipeEvent
}

type Handler<K extends keyof EventMap> = (payload: EventMap[K]) => void

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

export function emitLocally<K extends keyof EventMap>(name: K, payload: EventMap[K]): void {
  for (const subscriber of (subscribers.get(name) ?? []) as Set<Handler<K>>) subscriber(payload)
}
