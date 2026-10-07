import { useFiles, type RemoteDocument } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import type { RemoteOwner } from '@/ipc/files'
import { OWNER_CHANGED, isDirty } from '@/stores/file-documents'
/**
 * What the user agreed to lose when closing explorers. Nothing is lost when deciding:
 * `release` applies it only after the closing succeeded, and asks again if any draft or
 * transfer changed since.
 */
export interface Abandonment {
  readonly tabIds: string[]
  readonly documents: readonly { tabId: string; id: string; owner: RemoteOwner; content: string }[]
  readonly transfers: readonly string[]
}
export function useFileProtection() {
  const files = useFiles()
  const dialogs = useFileDialogs()
  async function save(tabId: string, document: RemoteDocument): Promise<boolean> {
    const saved = await files.saveDocument(tabId, document.id)
    return saved && !isDirty(document)
  }
  async function decide(tabIds: string[]): Promise<Abandonment | null> {
    const documents: Abandonment['documents'][number][] = []
    for (const tabId of tabIds) {
      if (files.panels[tabId]?.documents.some((doc) => doc.saving)) return null
      for (const document of files.unsaved(tabId)) {
        // Never offer to save a draft through another endpoint or account.
        const savable = files.ownsDocument(tabId, document)
        const answer = await dialogs.ask({
          title: 'Modifications non enregistrées',
          description: savable ? document.path : `${document.path}\n${OWNER_CHANGED}`,
          actions: [
            ...(savable ? [{ label: 'Enregistrer et fermer', value: 'save' as const }] : []),
            { label: 'Abandonner les modifications', value: 'discard' as const, destructive: true },
          ],
        })
        if (answer.choice === 'cancel') return null
        if (answer.choice === 'save') {
          if (!(await save(tabId, document))) return null
        } else
          documents.push({
            tabId,
            id: document.id,
            owner: document.owner,
            content: document.content,
          })
      }
    }
    const transfers = tabIds.flatMap((id) => files.activeTransfers(id))
    if (transfers.length) {
      const answer = await dialogs.ask({
        title: 'Arrêter les transferts en cours ?',
        description:
          'Les transferts et leurs préparations seront annulés. Les fichiers déjà transférés resteront à destination.',
        actions: [{ label: 'Arrêter et continuer', value: 'stop', destructive: true }],
      })
      if (answer.choice !== 'stop') return null
    }
    return { tabIds, documents, transfers }
  }
  /** True while every draft and transfer the decision covers is unchanged and no other appeared. */
  function current(decision: Abandonment): boolean {
    return decision.tabIds.every((tabId) => {
      if (files.panels[tabId]?.documents.some((doc) => doc.saving)) return false
      const agreed = (doc: RemoteDocument) =>
        decision.documents.some(
          (kept) =>
            kept.tabId === tabId &&
            kept.id === doc.id &&
            kept.owner === doc.owner &&
            kept.content === doc.content,
        )
      return (
        files.unsaved(tabId).every(agreed) &&
        files.activeTransfers(tabId).every((id) => decision.transfers.includes(id))
      )
    })
  }
  /** Runs `close` once the decision is still current, then releases its explorers. */
  async function release(decision: Abandonment, close: () => boolean): Promise<boolean> {
    let agreed: Abandonment | null = decision
    while (agreed && !current(agreed)) agreed = await decide(agreed.tabIds)
    if (!agreed || !close()) return false
    agreed.tabIds.forEach((tabId) => files.release(tabId))
    return true
  }
  return { protect: decide, current, release }
}
