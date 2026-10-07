import { reactive } from 'vue'
import { filesApi, type RemoteText } from '@/ipc/files'
import { describeError, errorCode } from '@/ipc/client'
import type { Connection, FileState } from './files'
/** The remote document a document tab shows, with the owner of the read that produced it. */
export interface RemoteDocument extends RemoteText {
  id: string
  original: string
  saving: boolean
  error: string | null
  conflict: boolean
}
/**
 * Whether the tab's current connection is the document's owner: `unknown` while
 * disconnected or until a reply on the new connection reveals its owner.
 */
export type Ownership = 'same' | 'other' | 'unknown'
export const isDirty = (document: RemoteDocument) => document.content !== document.original
export const OWNER_CHANGED =
  'Le serveur ou le compte a changé. Ce document appartient à la connexion précédente.'
export const RECONNECT = 'Reconnectez le terminal avant d’enregistrer.'
const UNCERTAIN = 'Connexion interrompue : vérifiez le fichier distant avant de réessayer.'
const REMOTE_CHANGED =
  'Le fichier distant a été modifié. Rechargez-le ou confirmez son remplacement'
interface Explorers {
  panels: Record<string, FileState>
  ensure(tabId: string): FileState
  connection(tabId: string): Connection | null
}
export function documentActions({ panels, ensure, connection }: Explorers) {
  const documents = reactive<Record<string, RemoteDocument>>({})
  function ownership(tabId: string): Ownership {
    const owner = panels[tabId]?.owner
    if (!documents[tabId] || !owner || !connection(tabId)) return 'unknown'
    return owner === documents[tabId].owner ? 'same' : 'other'
  }
  function editDocument(tabId: string, content: string) {
    if (documents[tabId]) documents[tabId].content = content
  }
  /** Reads `path` into the tab, or checks its document against a new connection. */
  async function openDocument(tabId: string, path: string) {
    const panel = ensure(tabId)
    const link = connection(tabId)
    const shown = documents[tabId]
    if (!link || (shown && (shown.path !== path || panel.owner))) return
    if (shown) return verify(tabId, shown, link)
    try {
      const text = await filesApi.request(link.sessionId, { operation: 'read', path })
      if (!link.current() || documents[tabId]) return
      panel.owner = text.owner
      documents[tabId] = {
        ...text,
        id: crypto.randomUUID(),
        original: text.content,
        saving: false,
        error: null,
        conflict: false,
      }
    } catch (cause) {
      if (link.current()) panel.error = describeError(cause)
    }
  }
  /** Learns the new connection's owner; a draft is kept, only an unedited document follows the server. */
  async function verify(tabId: string, document: RemoteDocument, link: Connection) {
    const content = document.content
    try {
      const text = await filesApi.request(link.sessionId, {
        operation: 'read',
        path: document.path,
      })
      if (!link.current() || documents[tabId] !== document) return
      panels[tabId].owner = text.owner
      if (text.owner !== document.owner || document.content !== content || document.saving) return
      if (text.content === content || !isDirty(document))
        Object.assign(document, text, { original: text.content, error: null, conflict: false })
      else if (text.content === document.original) {
        if (document.error === UNCERTAIN) document.error = null
      } else Object.assign(document, { error: REMOTE_CHANGED, conflict: true })
    } catch (cause) {
      if (link.current() && documents[tabId] === document) document.error = describeError(cause)
    }
  }
  async function saveDocument(tabId: string, overwrite = false): Promise<boolean> {
    const document = documents[tabId]
    if (!document || document.saving) return false
    const link = connection(tabId)
    if (!link) {
      document.error = RECONNECT
      return false
    }
    // Only the connection's own endpoint and account may save the document.
    const owned = ownership(tabId)
    if (owned !== 'same') {
      if (owned === 'other') document.error = OWNER_CHANGED
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
  async function reloadDocument(tabId: string) {
    const document = documents[tabId]
    const link = connection(tabId)
    if (!document || !link || document.saving || ownership(tabId) !== 'same') return
    const content = document.content
    try {
      const text = await filesApi.request(link.sessionId, {
        operation: 'read',
        path: document.path,
      })
      if (document.content !== content || !link.current()) return
      panels[tabId].owner = text.owner
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
    forget: (tabId: string) => {
      delete documents[tabId]
    },
    actions: {
      document: (tabId: string): RemoteDocument | undefined => documents[tabId],
      ownership,
      editDocument,
      openDocument,
      saveDocument,
      reloadDocument,
    },
  }
}
