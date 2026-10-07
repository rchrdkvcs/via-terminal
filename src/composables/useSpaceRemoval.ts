import type { Id } from '@/ipc/types'
import { tabs } from '@/domain/space'
import { useSessions } from '@/stores/sessions'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useFiles } from '@/stores/files'
import { useFileProtection } from './useFileProtection'
import { useWorkbench } from '@/stores/workbench'

export function useSpaceRemoval() {
  const spaces = useSpaces()
  const sessions = useSessions()
  const ui = useUi()
  const workbench = useWorkbench()

  const protection = useFileProtection()
  async function request(id: Id) {
    const space = spaces.byId(id)
    if (!space || spaces.spaces.length <= 1) return
    if (!(await protection.protect(tabs(space).map((tab) => tab.id)))) return
    const running = tabs(space).filter((tab) => sessions.isLive(tab.id)).length
    ui.confirm({
      title: `Supprimer l’espace « ${space.name} » ?`,
      description: running
        ? `${running} ${running > 1 ? 'onglets actifs seront fermés' : 'onglet actif sera fermé'}, ainsi que ses onglets épinglés et dossiers. Les hôtes du coffre ne sont pas touchés.`
        : 'Ses onglets épinglés et dossiers seront supprimés. Les hôtes du coffre ne sont pas touchés.',
      confirm: 'Supprimer l’espace',
      destructive: true,
      run: () => {
        if (workbench.removeSpace(id)) tabs(space).forEach((tab) => useFiles().release(tab.id))
      },
    })
  }

  return { request }
}
