import { onScopeDispose, watch } from 'vue'
import { on } from '@/ipc/events'
import type { TransferEvent } from '@/ipc/files'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import { useSessions } from '@/stores/sessions'
import { useSpaces } from '@/stores/spaces'
import { isPinned } from '@/domain/space'
/** Routes native transfer events, asks collision questions and keeps tab directories. */
export function useFileRuntime() {
  const files = useFiles(),
    sessions = useSessions(),
    spaces = useSpaces(),
    dialogs = useFileDialogs()
  async function resolve(event: TransferEvent) {
    const { choice, all } = await dialogs.ask({
      title: 'Le fichier existe déjà',
      description:
        event.path +
        '\nPour un dossier, Remplacer fusionne le contenu en conservant les autres fichiers.',
      applyAll: true,
      actions: [
        { label: 'Remplacer', value: 'replace', destructive: true },
        { label: 'Ignorer', value: 'skip' },
        { label: 'Conserver les deux', value: 'keepBoth' },
      ],
    })
    await files.resolveTransfer(event.id, choice, all)
  }
  const stop = on('file-transfer', async (event) => {
    const tabId = sessions.tabOf(event.sessionId)
    files.transferEvent(event)
    if (!tabId) return
    if (event.state === 'conflict') await resolve(event)
    const panel = files.panels[tabId]
    if (panel && (event.state === 'completed' || event.state === 'cancelled'))
      void files.navigate(tabId, panel.directory)
  })
  watch(
    () =>
      Object.entries(files.panels).map(([id, panel]) => {
        const space = spaces.spaceOf(id)
        return [id, panel.directory, Boolean(space && isPinned(space, id))] as const
      }),
    (directories) => {
      for (const [tabId, path] of directories) {
        const space = spaces.spaceOf(tabId)
        if (space) spaces.dispatch({ type: 'navigate', tabId, side: 'remote', path }, space.id)
      }
    },
  )
  onScopeDispose(stop)
}
