import { onScopeDispose, watch } from 'vue'
import { on } from '@/ipc/events'
import { filesApi, type FileRequest, type TransferEvent } from '@/ipc/files'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import { useSessions } from '@/stores/sessions'
import { useSpaces } from '@/stores/spaces'
import { findTab, isPinned } from '@/domain/space'
/** Routes native transfer events, asks collision questions and follows session changes. */
export function useFileRuntime() {
  const files = useFiles(),
    sessions = useSessions(),
    spaces = useSpaces(),
    dialogs = useFileDialogs()
  async function resolve(tabId: string, event: TransferEvent) {
    const answer = await dialogs.ask({
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
    const runtime = sessions.runtime(tabId)
    if (runtime.sessionId !== event.sessionId || runtime.state !== 'ready') return
    const { choice, all } = answer
    const request: FileRequest =
      choice === 'cancel'
        ? { operation: 'cancel', id: event.id }
        : { operation: 'resolve', id: event.id, choice, all }
    await filesApi.request(event.sessionId, request).catch(() => undefined)
  }
  const stop = on('file-transfer', async (event) => {
    const tabId = sessions.tabOf(event.sessionId)
    files.transferEvent(tabId, event)
    if (!tabId) return
    if (event.state === 'conflict') await resolve(tabId, event)
    const panel = files.panels[tabId]
    if (
      (event.state === 'completed' || event.state === 'cancelled') &&
      panel?.sessionId === event.sessionId &&
      sessions.runtime(tabId).state === 'ready'
    )
      void files.navigate(tabId, event.sessionId, panel.directory)
  })
  watch(
    () =>
      Object.entries(files.panels).map(
        ([id, panel]) =>
          [
            id,
            panel.sessionId,
            sessions.runtime(id).sessionId,
            sessions.runtime(id).state,
          ] as const,
      ),
    (states) => {
      for (const [id, previous, current, state] of states)
        if (previous && (previous !== current || state !== 'ready')) files.disconnect(id)
    },
  )
  watch(
    () =>
      Object.entries(files.panels).map(([id, panel]) => {
        const space = spaces.spaceOf(id)
        return [id, panel.directory, Boolean(space && isPinned(space, id))] as const
      }),
    (directories) => {
      for (const [id, remoteCwd, pinned] of directories) {
        const space = spaces.spaceOf(id),
          tab = space && findTab(space, id)
        if (tab && !pinned && remoteCwd.startsWith('/') && tab.remoteCwd !== remoteCwd)
          spaces.dispatch({ type: 'updateTab', tabId: id, patch: { remoteCwd } }, space!.id)
      }
    },
  )
  onScopeDispose(stop)
}
