import { useFiles, type RemoteDocument } from '@/stores/files'
import { useFileDialogs } from '@/stores/file-dialogs'
import type { RemoteOwner } from '@/ipc/files'
import { OWNER_CHANGED, RECONNECT, isDirty } from '@/stores/file-document'
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
  const unsaved = (tabId: string) => {
    const document = files.document(tabId)
    return document && isDirty(document) ? document : undefined
  }
  async function save(tabId: string, document: RemoteDocument): Promise<boolean> {
    const saved = await files.saveDocument(tabId)
    return saved && !isDirty(document)
  }
  /** Asks about the tab's draft: saved, discarded (`discard`), or kept open (`cancel`). */
  async function settle(tabId: string): Promise<'clean' | 'discard' | 'cancel'> {
    if (files.document(tabId)?.saving) return 'cancel'
    const document = unsaved(tabId)
    if (!document) return 'clean'
    // Save is offered only through the document's own endpoint and account.
    const ownership = files.ownership(tabId)
    const savable = ownership === 'same'
    const answer = await dialogs.ask({
      title: 'Modifications non enregistrées',
      description: savable
        ? document.path
        : `${document.path}\n${ownership === 'other' ? OWNER_CHANGED : RECONNECT}`,
      actions: [
        ...(savable ? [{ label: 'Enregistrer et fermer', value: 'save' as const }] : []),
        { label: 'Abandonner les modifications', value: 'discard' as const, destructive: true },
      ],
    })
    if (answer.choice === 'cancel') return 'cancel'
    if (answer.choice === 'discard') return 'discard'
    return (await save(tabId, document)) ? 'clean' : 'cancel'
  }
  async function decide(tabIds: string[]): Promise<Abandonment | null> {
    const documents: Abandonment['documents'][number][] = []
    for (const tabId of tabIds) {
      const document = unsaved(tabId)
      const choice = await settle(tabId)
      if (choice === 'cancel') return null
      if (choice === 'discard' && document)
        documents.push({
          tabId,
          id: document.id,
          owner: document.owner,
          content: document.content,
        })
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
      if (files.document(tabId)?.saving) return false
      const document = unsaved(tabId)
      const agreed =
        !document ||
        decision.documents.some(
          (kept) =>
            kept.tabId === tabId &&
            kept.id === document.id &&
            kept.owner === document.owner &&
            kept.content === document.content,
        )
      return agreed && files.activeTransfers(tabId).every((id) => decision.transfers.includes(id))
    })
  }
  /** Runs `close`, which releases the explorers, once the decision is still current. */
  async function release(decision: Abandonment, close: () => boolean): Promise<boolean> {
    let agreed: Abandonment | null = decision
    while (agreed && !current(agreed)) agreed = await decide(agreed.tabIds)
    return !!agreed && close()
  }
  /**
   * Closes the document a dialog or a docked explorer shows, once its draft is saved or
   * abandoned. False when the user kept it open.
   */
  async function closeDocument(tabId: string): Promise<boolean> {
    const content = unsaved(tabId)?.content
    const choice = await settle(tabId)
    if (choice === 'cancel') return false
    // Typing went on while the question was open: what was agreed no longer covers it.
    const draft = unsaved(tabId)
    if (draft && draft.content !== content) return closeDocument(tabId)
    files.closeDocument(tabId)
    return true
  }
  return { protect: decide, current, release, closeDocument }
}
