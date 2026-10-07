import { onScopeDispose, watch } from 'vue'
import { on } from '@/ipc/events'
import { filesApi } from '@/ipc/files'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import { useSessions } from '@/stores/sessions'
import { useSpaces } from '@/stores/spaces'
import { findTab } from '@/domain/space'
import { transferPlans } from '@/components/files/useFileTransfers'
export function useFileRuntime() {
  const files = useFiles(),
    sessions = useSessions(),
    spaces = useSpaces(),
    dialogs = useFileDialogs()
  const stop = on('file-transfer', async (event) => {
    const saved = transferPlans.get(event.id)
    if (saved) {
      saved.state = event.state
      saved.plan.completedSources = event.completedSources ?? []
      saved.plan.directories = event.directories ?? {}
    }
    const tabId = sessions.tabOf(event.sessionId)
    if (tabId) files.transferEvent(tabId, event)
    if (event.state === 'conflict' && tabId) {
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
      if (
        sessions.runtime(tabId).sessionId !== event.sessionId ||
        sessions.runtime(tabId).state !== 'ready'
      )
        return
      const request =
        answer.choice === 'cancel'
          ? { operation: 'cancel' as const, id: event.id }
          : {
              operation: 'resolve' as const,
              id: event.id,
              choice: answer.choice as 'replace' | 'skip' | 'keepBoth',
              all: answer.all,
            }
      await filesApi.request(event.sessionId, request).catch(() => undefined)
    }
    if (
      event.state === 'completed' ||
      event.state === 'cancelled' ||
      (saved && !files.panels[saved.tabId] && event.state === 'failed')
    ) {
      if (saved?.plan.stagingId)
        await filesApi.stageDiscard(saved.plan.stagingId).catch(() => undefined)
      transferPlans.delete(event.id)
      const panel = tabId && files.panels[tabId]
      if (panel && sessions.runtime(tabId).state === 'ready')
        void files.navigate(tabId, event.sessionId, panel.directory)
    }
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
    () => Object.keys(files.panels),
    () => {
      for (const [id, saved] of transferPlans) {
        if (!files.panels[saved.tabId] && !['running', 'conflict'].includes(saved.state)) {
          if (saved.plan.stagingId)
            void filesApi.stageDiscard(saved.plan.stagingId).catch(() => undefined)
          transferPlans.delete(id)
        }
      }
    },
  )
  watch(
    () => Object.entries(files.panels).map(([id, panel]) => [id, panel.directory] as const),
    (directories) => {
      for (const [id, remoteCwd] of directories) {
        const space = spaces.spaceOf(id),
          tab = space && findTab(space, id)
        if (tab && remoteCwd.startsWith('/') && tab.remoteCwd !== remoteCwd)
          spaces.dispatch({ type: 'updateTab', tabId: id, patch: { remoteCwd } }, space!.id)
      }
    },
  )
  onScopeDispose(stop)
}
