import type { Id, Target } from '@/ipc/types'
import { findTab, tabs } from '@/domain/space'
import { notify } from '@/lib/notify'
import { useFiles } from '@/stores/files'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useWorkbench, type Closed } from '@/stores/workbench'
import { useFileProtection, type Abandonment } from './useFileProtection'
import { useTabLabel } from './useTabLabel'

/**
 * Every destructive intent: asks about what it would lose, confirms, then closes and
 * offers undo. Drafts and transfers are abandoned only once the closing happened.
 */
export function useClosing() {
  const files = useFiles()
  const spaces = useSpaces()
  const sessions = useSessions()
  const settings = useSettings()
  const ui = useUi()
  const workbench = useWorkbench()
  const names = useTabLabel()
  const protection = useFileProtection()

  async function closeTab(tabId: Id) {
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
        run: () => void finishTab(tabId, name, decision),
      })
      return
    }
    await finishTab(tabId, name, decision)
  }

  async function finishTab(tabId: Id, name: string, decision: Abandonment) {
    let closed: Closed | undefined
    if (!(await protection.release(decision, () => !!(closed = workbench.closeTab(tabId))))) return
    const undo = closed?.undo
    if (undo) notify.info(`« ${name} » retiré des épinglés`, { label: 'Annuler', run: undo })
  }

  async function replaceTab(tabId: Id, target: Target) {
    const decision = await protection.protect([tabId])
    if (decision) await protection.release(decision, () => !!workbench.replace(tabId, target))
  }

  async function removeSpace(spaceId: Id) {
    const space = spaces.byId(spaceId)
    if (!space || spaces.spaces.length <= 1) return
    const decision = await protection.protect(tabs(space).map((tab) => tab.id))
    if (!decision) return
    const running = tabs(space).filter((tab) => sessions.isLive(tab.id)).length
    ui.confirm({
      title: `Supprimer l’espace « ${space.name} » ?`,
      description: running
        ? `${running} ${running > 1 ? 'onglets actifs seront fermés' : 'onglet actif sera fermé'}, ainsi que ses onglets épinglés et dossiers. Les hôtes du coffre ne sont pas touchés.`
        : 'Ses onglets épinglés et dossiers seront supprimés. Les hôtes du coffre ne sont pas touchés.',
      confirm: 'Supprimer l’espace',
      destructive: true,
      run: () => void protection.release(decision, () => workbench.removeSpace(spaceId)),
    })
  }

  /**
   * Before quitting or updating: true once every explorer is protected and `prepare`
   * finished with nothing changed meanwhile. Explorers stay open; the application closes.
   */
  async function leave(prepare: () => Promise<unknown>): Promise<boolean> {
    for (;;) {
      const decision = await protection.protect(Object.keys(files.panels))
      if (!decision) return false
      await prepare()
      if (protection.current(decision)) return true
    }
  }

  return { closeTab, replaceTab, removeSpace, leave }
}
