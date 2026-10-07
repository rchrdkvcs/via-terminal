import { onScopeDispose, watch } from 'vue'
import { on } from '@/ipc/events'
import type { TransferEvent } from '@/ipc/files'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import { useSessions } from '@/stores/sessions'
import { useSpaces } from '@/stores/spaces'
import { findTab, isPinned } from '@/domain/space'
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
  // Terminals and explorer tabs follow their directory until pinned, then keep the one they
  // were pinned at.
  watch(
    () =>
      Object.entries(files.panels).map(([id, panel]) => {
        const space = spaces.spaceOf(id)
        return [id, panel.directory, Boolean(space && isPinned(space, id))] as const
      }),
    (directories) => {
      for (const [id, path, pinned] of directories) {
        const space = spaces.spaceOf(id),
          tab = space && findTab(space, id)
        if (!space || !tab || pinned || !path.startsWith('/')) continue
        if (!tab.view && tab.remoteCwd !== path)
          spaces.dispatch({ type: 'updateTab', tabId: id, patch: { remoteCwd: path } }, space.id)
        else if (tab.view?.kind === 'files' && tab.view.path !== path)
          spaces.dispatch(
            { type: 'updateTab', tabId: id, patch: { view: { kind: 'files', path } } },
            space.id,
          )
      }
    },
  )
  onScopeDispose(stop)
}
