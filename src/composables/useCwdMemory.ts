import type { Id } from '@/ipc/types'
import { findTab } from '@/domain/space'
import { parseOsc7, parseOsc9 } from '@/lib/cwd'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'

export function useCwdMemory() {
  const settings = useSettings()
  const spaces = useSpaces()

  return function remember(tabId: Id, payload: string, osc: 7 | 9) {
    const windows = settings.platform === 'windows'
    const cwd = osc === 7 ? parseOsc7(payload, windows) : parseOsc9(payload, windows)
    const space = spaces.spaceOf(tabId)
    const tab = space && findTab(space, tabId)
    if (!cwd || !tab || tab.target.kind !== 'local' || tab.target.cwd === cwd) return
    spaces.dispatch(
      { type: 'updateTab', tabId, patch: { target: { ...tab.target, cwd } } },
      space.id,
    )
  }
}
