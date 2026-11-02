import { defineStore } from 'pinia'
import { onScopeDispose, reactive } from 'vue'
import type { Id } from '@/ipc/types'

/**
 * What a running terminal is doing, as far as its output tells:
 * - `working`: it keeps printing without being typed into, or its title shows a spinner;
 * - `waiting`: it rang the bell, sent a notification, or finished a long run while the user
 *   was looking elsewhere; seeing the tab clears it;
 * - `idle`: none of the above.
 */
export type Activity = 'idle' | 'working' | 'waiting'

/** Output this soon after a key press or resize is the terminal answering it, not work. */
export const ECHO_MS = 300
/** Silence that ends a working spell. */
export const QUIET_MS = 1500
/** A working spell at least this long asks for attention when it ends out of sight. */
export const LONG_MS = 4000

/** Braille spinners (⠋ ⠙ ⠹ …) that CLI tools put in front of their title while busy. */
export const workingTitle = (title: string | null): boolean => !!title && /^[⠀-⣿]/.test(title)

interface Track {
  quietSince: number
  start: number
  timer: ReturnType<typeof setTimeout> | undefined
}

export const useActivity = defineStore('activity', () => {
  const flags = reactive<Record<Id, { working: boolean; waiting: boolean }>>({})
  const tracks = new Map<Id, Track>()
  let viewed: Id | undefined

  function track(tabId: Id): Track {
    let current = tracks.get(tabId)
    if (!current) {
      current = { quietSince: 0, start: 0, timer: undefined }
      tracks.set(tabId, current)
    }
    flags[tabId] ??= { working: false, waiting: false }
    return current
  }

  /** Typing or resizing: the output right after it is an echo or a redraw. */
  function input(tabId: Id) {
    track(tabId).quietSince = Date.now()
  }

  function output(tabId: Id) {
    const current = track(tabId)
    const now = Date.now()
    if (now - current.quietSince < ECHO_MS) return
    const flag = flags[tabId]
    if (!flag.working) {
      flag.working = true
      current.start = now
    }
    clearTimeout(current.timer)
    current.timer = setTimeout(() => settle(tabId), QUIET_MS)
  }

  function settle(tabId: Id) {
    const current = tracks.get(tabId)
    const flag = flags[tabId]
    if (!current || !flag) return
    current.timer = undefined
    flag.working = false
    if (tabId !== viewed && Date.now() - current.start - QUIET_MS >= LONG_MS) flag.waiting = true
  }

  /** A bell or a desktop notification from the program. */
  function bell(tabId: Id) {
    track(tabId)
    if (tabId !== viewed) flags[tabId].waiting = true
  }

  function view(tabId: Id | undefined) {
    viewed = tabId
    if (tabId && flags[tabId]) flags[tabId].waiting = false
  }

  function of(tabId: Id): Activity {
    const flag = flags[tabId]
    return flag?.waiting ? 'waiting' : flag?.working ? 'working' : 'idle'
  }

  /** The session ended or the tab closed. */
  function release(tabId: Id) {
    clearTimeout(tracks.get(tabId)?.timer)
    tracks.delete(tabId)
    delete flags[tabId]
  }

  onScopeDispose(() => tracks.forEach((current) => clearTimeout(current.timer)))

  return { input, output, bell, view, of, release }
})
