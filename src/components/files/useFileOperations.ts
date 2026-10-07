import { filesApi, type FileRequest, type RemoteEntry } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
export interface ExplorerContext {
  tabId: () => string
  sessionId: () => string | null
}
/** The explorer's tab and connection when an action began; stale once either changed. */
export interface ExplorerScope {
  tabId: string
  sessionId: string | null
  current(): boolean
}
export function explorerScope(context: ExplorerContext): ExplorerScope {
  const tabId = context.tabId(),
    sessionId = context.sessionId()
  return {
    tabId,
    sessionId,
    current: () => context.tabId() === tabId && context.sessionId() === sessionId,
  }
}
/** Reports an error on a still-open explorer without recreating a released one. */
export function reportError(tabId: string, cause: unknown) {
  useFiles().reportError(tabId, describeError(cause))
}
const absolutePath = (path: string) =>
  path.startsWith('/') && !path.includes('\0') ? null : 'Indiquez un chemin distant absolu.'
const octalMode = (mode: string) =>
  /^[0-7]{3,4}$/.test(mode)
    ? null
    : 'Les permissions doivent contenir trois ou quatre chiffres octaux.'
export function useFileOperations(context: ExplorerContext) {
  const files = useFiles()
  const dialogs = useFileDialogs()
  async function execute(scope: ExplorerScope, request: FileRequest) {
    if (!scope.sessionId || !scope.current()) return
    try {
      await filesApi.request(scope.sessionId, request)
      if (scope.current())
        await files.navigate(scope.tabId, scope.sessionId, files.state(scope.tabId).directory)
    } catch (cause) {
      reportError(scope.tabId, cause)
    }
  }
  async function create(directory: boolean) {
    const scope = explorerScope(context),
      parent = files.state(scope.tabId).directory
    const answer = await dialogs.ask({
      title: directory ? 'Nouveau dossier' : 'Nouveau fichier',
      description: parent,
      input: '',
      inputLabel: 'Nom',
      actions: [{ label: 'Créer', value: 'create' }],
      validate: (name) => (name.trim() ? null : 'Indiquez un nom.'),
    })
    if (answer.choice === 'create')
      await execute(scope, { operation: 'create', parent, name: answer.value.trim(), directory })
  }
  async function change(entry: RemoteEntry, operation: 'move' | 'chmod') {
    const scope = explorerScope(context)
    const answer = await dialogs.ask({
      title: operation === 'move' ? 'Renommer ou déplacer' : 'Permissions Unix',
      description: entry.path,
      input: operation === 'move' ? entry.path : ((entry.permissions ?? 0) & 0o7777).toString(8),
      inputLabel: operation === 'move' ? 'Chemin de destination' : 'Permissions octales (ex. 644)',
      actions: [{ label: 'Appliquer', value: 'apply' }],
      validate: operation === 'move' ? absolutePath : octalMode,
    })
    if (answer.choice !== 'apply' || !scope.current()) return
    if (operation === 'move')
      await execute(scope, { operation, path: entry.path, destination: answer.value })
    else
      await execute(scope, { operation, path: entry.path, permissions: parseInt(answer.value, 8) })
  }
  async function remove(entries: RemoteEntry[]) {
    const scope = explorerScope(context)
    const answer = await dialogs.ask({
      title: 'Supprimer définitivement ?',
      description:
        entries.map((entry) => entry.path).join('\n') +
        '\nLes dossiers seront supprimés avec leur contenu. Aucune corbeille distante.',
      actions: [{ label: 'Supprimer définitivement', value: 'delete', destructive: true }],
    })
    if (answer.choice !== 'delete') return
    for (const entry of entries) {
      if (!scope.current()) break
      await execute(scope, { operation: 'delete', path: entry.path })
    }
  }
  return { create, change, remove }
}
