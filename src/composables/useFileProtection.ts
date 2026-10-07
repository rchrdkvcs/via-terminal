import { useFiles } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import { useSessions } from '@/stores/sessions'
export function useFileProtection() {
  const files = useFiles()
  const dialogs = useFileDialogs()
  const sessions = useSessions()
  async function documents(tabId: string, only?: string): Promise<boolean> {
    const panel = files.panels[tabId]
    if (!panel) return true
    for (const document of panel.documents) {
      if (only && only !== document.id) continue
      if (document.saving) return false
      if (document.content === document.original) continue
      const answer = await dialogs.ask({
        title: 'Modifications non enregistrées',
        description: document.path,
        actions: [
          { label: 'Enregistrer', value: 'save' },
          { label: 'Abandonner', value: 'discard', destructive: true },
        ],
      })
      if (answer.choice === 'cancel') return false
      if (answer.choice === 'save') {
        const runtime = sessions.runtime(tabId)
        if (runtime.state !== 'ready' || !runtime.sessionId) {
          document.error = 'Reconnectez le terminal avant d’enregistrer.'
          return false
        }
        if (!(await files.saveDocument(tabId, runtime.sessionId, document.id))) return false
        if (document.content !== document.original) return false
      } else document.content = document.original
    }
    return true
  }
  async function protect(tabIds: string[]): Promise<boolean> {
    for (const id of tabIds) if (!(await documents(id))) return false
    const active = tabIds.filter((id) => files.panels[id] && files.hasTransfers(id))
    if (!active.length) return true
    const answer = await dialogs.ask({
      title: 'Arrêter les transferts en cours ?',
      description:
        'Les transferts seront annulés. Les fichiers déjà transférés resteront à destination.',
      actions: [{ label: 'Arrêter et continuer', value: 'stop', destructive: true }],
    })
    return answer.choice === 'stop'
  }
  async function closeDocument(tabId: string, id: string) {
    if (await documents(tabId, id)) files.discardDocument(tabId, id)
  }
  return { protect, closeDocument }
}
