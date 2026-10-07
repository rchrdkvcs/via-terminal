import { filesApi, type RemoteText } from '@/ipc/files'
import { describeError, errorCode } from '@/ipc/client'
import type { Connection, FileState } from './files'
export interface RemoteDocument extends RemoteText {
  id: string
  original: string
  saving: boolean
  error: string | null
  conflict: boolean
}
export const isDirty = (document: RemoteDocument) => document.content !== document.original
export const OWNER_CHANGED =
  'Le serveur ou le compte a changé. Ce document appartient à la connexion précédente.'
const RECONNECT = 'Reconnectez le terminal avant d’enregistrer.'
const UNCERTAIN = 'Connexion interrompue : vérifiez le fichier distant avant de réessayer.'
interface Explorers {
  panels: Record<string, FileState>
  ensure(tabId: string): FileState
  connection(tabId: string): Connection | null
}
export function documentActions({ panels, ensure, connection }: Explorers) {
  const find = (tabId: string, id: string) => panels[tabId]?.documents.find((doc) => doc.id === id)
  function editDocument(tabId: string, id: string, content: string) {
    const document = find(tabId, id)
    if (document) document.content = content
  }
  /** Only the explorer's current endpoint and account may save or reload a document. */
  function ownsDocument(tabId: string, document: RemoteDocument) {
    return document.owner === panels[tabId]?.owner
  }
  async function openDocument(tabId: string, path: string) {
    const panel = ensure(tabId)
    const link = connection(tabId)
    if (!link || panel.documents.some((doc) => doc.path === path)) return
    try {
      const text = await filesApi.request(link.sessionId, { operation: 'read', path })
      if (!link.current() || panel.documents.some((doc) => doc.path === path)) return
      panel.owner ??= text.owner
      const document = {
        ...text,
        id: crypto.randomUUID(),
        original: text.content,
        saving: false,
        error: null,
        conflict: false,
      }
      panel.documents.push(document)
    } catch (cause) {
      if (link.current()) panel.error = describeError(cause)
    }
  }
  async function saveDocument(tabId: string, id: string, overwrite = false): Promise<boolean> {
    const document = find(tabId, id)
    if (!document || document.saving) return false
    if (!ownsDocument(tabId, document)) {
      document.error = OWNER_CHANGED
      return false
    }
    const link = connection(tabId)
    if (!link) {
      document.error = RECONNECT
      return false
    }
    const content = document.content
    document.saving = true
    document.error = null
    document.conflict = false
    try {
      const saved = await filesApi.request(link.sessionId, {
        operation: 'save',
        document: { ...document, content },
        original: document.original,
        overwrite,
      })
      if (!link.current()) {
        document.error = UNCERTAIN
        return false
      }
      Object.assign(document, {
        original: content,
        permissions: saved.permissions,
        uid: saved.uid,
        gid: saved.gid,
      })
      return true
    } catch (cause) {
      // After the connection changed, the outcome is uncertain: keep the draft either way.
      if (!link.current()) document.error = UNCERTAIN
      else {
        document.error = describeError(cause)
        document.conflict = errorCode(cause) === 'file_conflict'
      }
      return false
    } finally {
      document.saving = false
    }
  }
  async function reloadDocument(tabId: string, id: string) {
    const document = find(tabId, id)
    const link = connection(tabId)
    if (!document || !link || document.saving || !ownsDocument(tabId, document)) return
    const content = document.content
    try {
      const text = await filesApi.request(link.sessionId, {
        operation: 'read',
        path: document.path,
      })
      if (document.content !== content || !link.current()) return
      if (text.owner !== document.owner) {
        document.error = OWNER_CHANGED
        return
      }
      Object.assign(document, text, { original: text.content, error: null, conflict: false })
    } catch (cause) {
      if (link.current()) document.error = describeError(cause)
    }
  }
  return {
    editDocument,
    ownsDocument,
    openDocument,
    saveDocument,
    reloadDocument,
  }
}
