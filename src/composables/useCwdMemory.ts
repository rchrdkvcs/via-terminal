import { reactive, watch } from 'vue'
import type { Id } from '@/ipc/types'
import { isPinned } from '@/domain/space'
import { parseOsc7, parseOsc9 } from '@/lib/cwd'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'

/** Feeds shell directory reports to the navigate intent, again when a tab gets unpinned. */
export function useCwdMemory() {
  const settings = useSettings()
  const spaces = useSpaces()
  const sessions = useSessions()
  const live = reactive<Record<Id, string>>({})

  function follow(tabId: Id) {
    const space = spaces.spaceOf(tabId)
    const path = live[tabId]
    if (space && path) spaces.dispatch({ type: 'navigate', tabId, side: 'local', path }, space.id)
  }

  watch(
    () =>
      Object.keys(live).map((id) => {
        const space = spaces.spaceOf(id)
        return [id, Boolean(space && isPinned(space, id)), sessions.isLive(id)] as const
      }),
    (entries) => {
      for (const [tabId, , alive] of entries) {
        if (alive) follow(tabId)
        else delete live[tabId]
      }
    },
  )

  return function remember(tabId: Id, payload: string, osc: 7 | 9) {
    const windows = settings.platform === 'windows'
    const cwd = osc === 7 ? parseOsc7(payload, windows) : parseOsc9(payload, windows)
    if (!cwd) return
    live[tabId] = cwd
    follow(tabId)
  }
}
