import type { Id } from '@/ipc/types'
import { placeFor } from '@/domain/drop'
import { type Space, findTab, locate, rowOfTab, successor } from '@/domain/space'
import { clone } from '@/lib/clone'
import { notify } from '@/lib/notify'
import { terminals } from '@/terminal/registry'
import { useSessions } from '@/stores/sessions'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'
import { useTabLabel } from './useTabLabel'

/**
 * Closing a running pinned tab puts it to sleep; closing an asleep or
 * temporary tab removes it, with Undo for pinned ones.
 */
export function useTabClosing() {
  const spaces = useSpaces()
  const sessions = useSessions()
  const settings = useSettings()
  const ui = useUi()
  const workbench = useWorkbench()
  const names = useTabLabel()

  function refocusAfter(space: Space, tabId: Id) {
    if (workbench.focused[space.id] !== tabId) return
    const next = successor(space, tabId)
    workbench.focused[space.id] = next
    if (next && sessions.isLive(next)) requestAnimationFrame(() => terminals.focus(next))
  }

  /** Remove a tab; a pinned one can come back to the same place with Undo. */
  function remove(space: Space, tabId: Id, undoable: boolean) {
    const row = rowOfTab(space, tabId)
    if (!row) return
    const snapshot = clone(row)
    const place = placeFor(space, row.id, 'after')
    const tab = findTab(space, tabId)
    const name = tab ? names.label(tab) : 'Onglet'
    refocusAfter(space, tabId)
    sessions.release(tabId)
    spaces.dispatch({ type: 'remove', id: row.kind === 'split' ? tabId : row.id }, space.id)
    if (!undoable || row.kind === 'split' || !place) return
    notify.info(`« ${name} » retiré des épinglés`, {
      label: 'Annuler',
      run: () => spaces.dispatch({ type: 'open', row: snapshot, to: place }, space.id),
    })
  }

  function close(tabId: Id, confirmed = false) {
    const space = spaces.spaceOf(tabId)
    if (!space) return
    const live = sessions.isLive(tabId)
    if (!confirmed && live && settings.settings.confirmCloseRunning) {
      const tab = findTab(space, tabId)
      ui.confirm({
        title: `Fermer « ${tab ? names.label(tab) : 'cet onglet'} » ?`,
        description: 'Sa session est encore active et sera arrêtée.',
        confirm: 'Fermer l’onglet',
        destructive: true,
        run: () => close(tabId, true),
      })
      return
    }
    const row = rowOfTab(space, tabId)
    const pinned = Boolean(row && locate(space, row.id)?.area === 'pinned')
    if (pinned && live) sessions.stop(tabId)
    else remove(space, tabId, pinned)
  }

  return { close, remove }
}
