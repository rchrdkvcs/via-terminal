import { filesApi, type FileRequest, type RemoteEntry } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { useFiles, type Connection } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
export interface ExplorerContext {
  tabId: () => string
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
  /** Runs on the connection the action began with, and only while it is still current. */
  async function execute(tabId: string, link: Connection | null, request: FileRequest) {
    if (!link?.current()) return
    try {
      await filesApi.request(link.sessionId, request)
      if (link.current()) await files.navigate(tabId, files.state(tabId).directory)
    } catch (cause) {
      if (link.current()) reportError(tabId, cause)
    }
  }
  async function create(directory: boolean) {
    const tabId = context.tabId(),
      link = files.connection(tabId),
      parent = files.state(tabId).directory
    const answer = await dialogs.ask({
      title: directory ? 'Nouveau dossier' : 'Nouveau fichier',
      description: parent,
      input: '',
      inputLabel: 'Nom',
      actions: [{ label: 'Créer', value: 'create' }],
      validate: (name) => (name.trim() ? null : 'Indiquez un nom.'),
    })
    if (answer.choice === 'create')
      await execute(tabId, link, {
        operation: 'create',
        parent,
        name: answer.value.trim(),
        directory,
      })
  }
  async function change(entry: RemoteEntry, operation: 'move' | 'chmod') {
    const tabId = context.tabId(),
      link = files.connection(tabId)
    const answer = await dialogs.ask({
      title: operation === 'move' ? 'Renommer ou déplacer' : 'Permissions Unix',
      description: entry.path,
      input: operation === 'move' ? entry.path : ((entry.permissions ?? 0) & 0o7777).toString(8),
      inputLabel: operation === 'move' ? 'Chemin de destination' : 'Permissions octales (ex. 644)',
      actions: [{ label: 'Appliquer', value: 'apply' }],
      validate: operation === 'move' ? absolutePath : octalMode,
    })
    if (answer.choice !== 'apply') return
    if (operation === 'move')
      await execute(tabId, link, { operation, path: entry.path, destination: answer.value })
    else
      await execute(tabId, link, {
        operation,
        path: entry.path,
        permissions: parseInt(answer.value, 8),
      })
  }
  async function remove(entries: RemoteEntry[]) {
    const tabId = context.tabId(),
      link = files.connection(tabId)
    const answer = await dialogs.ask({
      title: 'Supprimer définitivement ?',
      description:
        entries.map((entry) => entry.path).join('\n') +
        '\nLes dossiers seront supprimés avec leur contenu. Aucune corbeille distante.',
      actions: [{ label: 'Supprimer définitivement', value: 'delete', destructive: true }],
    })
    if (answer.choice !== 'delete') return
    for (const entry of entries)
      await execute(tabId, link, { operation: 'delete', path: entry.path })
  }
  return { create, change, remove }
}
