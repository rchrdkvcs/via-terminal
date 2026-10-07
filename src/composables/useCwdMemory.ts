import { reactive, watch } from 'vue'
import type { Id } from '@/ipc/types'
import { findTab, isPinned } from '@/domain/space'
import { parseOsc7, parseOsc9 } from '@/lib/cwd'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'

/** Pinned tabs keep the directory they were pinned with; only temporary tabs follow the shell. */
export function useCwdMemory() {
  const settings = useSettings()
  const spaces = useSpaces()
  const sessions = useSessions()
  const live = reactive<Record<Id, string>>({})

  watch(
    () =>
      Object.entries(live).map(([id, cwd]) => {
        const space = spaces.spaceOf(id)
        return [id, cwd, Boolean(space && isPinned(space, id)), sessions.isLive(id)] as const
      }),
    (entries) => {
      for (const [tabId, cwd, pinned, alive] of entries) {
        if (!alive) {
          delete live[tabId]
          continue
        }
        const space = spaces.spaceOf(tabId)
        const tab = space && findTab(space, tabId)
        if (pinned || !tab || tab.target.kind !== 'local' || tab.target.cwd === cwd) continue
        spaces.dispatch(
          { type: 'updateTab', tabId, patch: { target: { ...tab.target, cwd } } },
          space.id,
        )
      }
    },
  )

  return function remember(tabId: Id, payload: string, osc: 7 | 9) {
    const windows = settings.platform === 'windows'
    const cwd = osc === 7 ? parseOsc7(payload, windows) : parseOsc9(payload, windows)
    if (cwd) live[tabId] = cwd
  }
}
