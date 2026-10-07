import type { Id } from '@/ipc/types'
import { findTab } from '@/domain/space'
import { notify } from '@/lib/notify'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'
import { useFileProtection, type Abandonment } from './useFileProtection'
import { useTabLabel } from './useTabLabel'

export function useTabClosing() {
  const spaces = useSpaces()
  const sessions = useSessions()
  const settings = useSettings()
  const ui = useUi()
  const workbench = useWorkbench()
  const names = useTabLabel()

  const protection = useFileProtection()
  async function close(tabId: Id) {
    const decision = await protection.protect([tabId])
    if (!decision) return
    const space = spaces.spaceOf(tabId)
    const tab = space && findTab(space, tabId)
    if (!tab) return
    const name = names.label(tab)
    if (sessions.isLive(tabId) && settings.settings.confirmCloseRunning) {
      ui.confirm({
        title: `Fermer « ${name} » ?`,
        description: 'Sa session est encore active et sera arrêtée.',
        confirm: 'Fermer l’onglet',
        destructive: true,
        run: () => {
          void finish(tabId, name, decision)
        },
      })
      return
    }
    await finish(tabId, name, decision)
  }
  // Drafts and transfers are abandoned only here, after every confirmation.
  async function finish(tabId: Id, name: string, decision: Abandonment) {
    let result: ReturnType<typeof workbench.closeTab>
    if (!(await protection.release(decision, () => !!(result = workbench.closeTab(tabId))))) return
    const undo = result?.undo
    if (undo) notify.info(`« ${name} » retiré des épinglés`, { label: 'Annuler', run: undo })
  }

  return { close }
}
