import { filesApi, type FileRequest, type RemoteEntry } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
export interface ExplorerContext {
  tabId: () => string
  sessionId: () => string | null
}
export function useFileOperations(context: ExplorerContext) {
  const files = useFiles()
  const dialogs = useFileDialogs()
  const panel = () => files.state(context.tabId())
  async function execute(request: FileRequest) {
    const tabId = context.tabId(),
      session = context.sessionId()
    if (!session) return
    try {
      await filesApi.request(session, request)
      if (context.tabId() === tabId && context.sessionId() === session)
        await files.navigate(tabId, session, files.state(tabId).directory)
    } catch (cause) {
      files.state(tabId).error = describeError(cause)
    }
  }
  async function create(directory: boolean) {
    const tabId = context.tabId(),
      sessionId = context.sessionId(),
      destination = panel().directory
    const answer = await dialogs.ask({
      title: directory ? 'Nouveau dossier' : 'Nouveau fichier',
      description: panel().directory,
      input: '',
      inputLabel: 'Nom',
      actions: [{ label: 'Créer', value: 'create' }],
    })
    if (
      answer.choice !== 'create' ||
      tabId !== context.tabId() ||
      sessionId !== context.sessionId()
    )
      return
    const name = answer.value.trim()
    if (!name || name === '.' || name === '..' || /[/\\\0]/.test(name)) {
      panel().error = 'Choisissez un nom de fichier sans séparateur de chemin.'
      return
    }
    await execute({
      operation: 'create',
      path: `${destination.replace(/\/$/, '')}/${name}`,
      directory,
    })
  }
  async function change(entry: RemoteEntry, operation: 'move' | 'chmod') {
    const tabId = context.tabId(),
      sessionId = context.sessionId()
    const answer = await dialogs.ask({
      title: operation === 'move' ? 'Renommer ou déplacer' : 'Permissions Unix',
      description: entry.path,
      input: operation === 'move' ? entry.path : ((entry.permissions ?? 0) & 0o7777).toString(8),
      inputLabel: operation === 'move' ? 'Chemin de destination' : 'Permissions octales (ex. 644)',
      actions: [{ label: 'Appliquer', value: 'apply' }],
    })
    if (answer.choice !== 'apply' || tabId !== context.tabId() || sessionId !== context.sessionId())
      return
    if (operation === 'move') {
      if (!answer.value.startsWith('/') || answer.value.includes('\0')) {
        panel().error = 'Indiquez un chemin distant absolu.'
        return
      }
      await execute({ operation, path: entry.path, destination: answer.value })
    } else {
      if (!/^[0-7]{3,4}$/.test(answer.value)) {
        panel().error = 'Les permissions doivent contenir trois ou quatre chiffres octaux.'
        return
      }
      await execute({ operation, path: entry.path, permissions: parseInt(answer.value, 8) })
    }
  }
  async function remove(entries: RemoteEntry[]) {
    const tabId = context.tabId(),
      sessionId = context.sessionId()
    const answer = await dialogs.ask({
      title: 'Supprimer définitivement ?',
      description:
        entries.map((entry) => entry.path).join('\n') +
        '\nLes dossiers seront supprimés avec leur contenu. Aucune corbeille distante.',
      actions: [{ label: 'Supprimer', value: 'delete', destructive: true }],
    })
    if (
      answer.choice === 'delete' &&
      tabId === context.tabId() &&
      sessionId === context.sessionId()
    )
      for (const entry of entries) {
        if (tabId !== context.tabId() || sessionId !== context.sessionId()) break
        await execute({ operation: 'delete', path: entry.path })
      }
  }
  return { create, change, remove }
}
