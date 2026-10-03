import type { Id } from '@/ipc/types'
import { findTab } from '@/domain/space'
import { notify } from '@/lib/notify'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'
import { useTabLabel } from './useTabLabel'

/** Presentation of close confirmations and the module's undo result. */
export function useTabClosing() {
  const spaces = useSpaces()
  const sessions = useSessions()
  const settings = useSettings()
  const ui = useUi()
  const workbench = useWorkbench()
  const names = useTabLabel()

  function close(tabId: Id, confirmed = false) {
    const space = spaces.spaceOf(tabId)
    const tab = space && findTab(space, tabId)
    if (!tab) return
    const name = names.label(tab)
    if (!confirmed && sessions.isLive(tabId) && settings.settings.confirmCloseRunning) {
      ui.confirm({
        title: `Fermer « ${name} » ?`,
        description: 'Sa session est encore active et sera arrêtée.',
        confirm: 'Fermer l’onglet',
        destructive: true,
        run: () => close(tabId, true),
      })
      return
    }
    const result = workbench.closeTab(tabId)
    if (result?.undo) {
      const undo = result.undo
      notify.info(`« ${name} » retiré des épinglés`, { label: 'Annuler', run: undo })
    }
  }

  return { close }
}
