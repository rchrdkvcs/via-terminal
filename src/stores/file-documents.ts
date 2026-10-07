import { filesApi, type RemoteText } from '@/ipc/files'
import { describeError, errorCode } from '@/ipc/client'
import type { FileState } from './files'
export interface RemoteDocument extends RemoteText {
  id: string
  original: string
  saving: boolean
  error: string | null
  conflict: boolean
}
export function documentActions(state: (id: string) => FileState) {
  async function openDocument(tabId: string, sessionId: string, path: string) {
    const panel = state(tabId)
    const existing = panel.documents.find((doc) => doc.path === path)
    if (existing) {
      panel.activeDocument = existing.id
      return
    }
    panel.sessionId = sessionId
    const generation = panel.generation
    try {
      const text = await filesApi.request<RemoteText>(sessionId, { operation: 'read', path })
      if (panel.generation !== generation) return
      const found = panel.documents.find((doc) => doc.path === path)
      if (found) {
        panel.activeDocument = found.id
        return
      }
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
      panel.activeDocument = document.id
    } catch (cause) {
      if (panel.generation === generation) panel.error = describeError(cause)
    }
  }
  async function saveDocument(
    tabId: string,
    sessionId: string,
    id: string,
    overwrite = false,
  ): Promise<boolean> {
    const panel = state(tabId)
    const document = panel.documents.find((doc) => doc.id === id)
    if (!document || document.saving) return false
    if (document.owner !== panel.owner) {
      document.error =
        'Le serveur ou le compte a changé. Ce document appartient à la connexion précédente.'
      return false
    }
    panel.sessionId = sessionId
    const content = document.content
    document.saving = true
    document.error = null
    document.conflict = false
    try {
      const saved = await filesApi.request<RemoteText>(sessionId, {
        operation: 'save',
        document: { ...document, content },
        original: document.original,
        overwrite,
      })
      if (panel.sessionId !== sessionId) {
        document.error = 'Connexion interrompue : vérifiez le fichier distant avant de réessayer.'
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
      document.error = describeError(cause)
      document.conflict = errorCode(cause) === 'file_conflict'
      return false
    } finally {
      document.saving = false
    }
  }
  async function reloadDocument(tabId: string, sessionId: string, id: string) {
    const panel = state(tabId)
    const document = panel.documents.find((doc) => doc.id === id)
    if (!document || document.saving || document.owner !== panel.owner) return
    const content = document.content
    const generation = panel.generation
    try {
      const text = await filesApi.request<RemoteText>(sessionId, {
        operation: 'read',
        path: document.path,
      })
      if (document.content !== content || panel.generation !== generation) return
      if (text.owner !== document.owner) {
        document.error =
          'Le serveur ou le compte a changé. Ce document appartient à la connexion précédente.'
        return
      }
      Object.assign(document, text, { original: text.content, error: null, conflict: false })
    } catch (cause) {
      document.error = describeError(cause)
    }
  }
  function discardDocument(tabId: string, id: string) {
    const panel = state(tabId)
    panel.documents = panel.documents.filter((doc) => doc.id !== id)
    if (panel.activeDocument === id)
      panel.activeDocument = panel.documents[panel.documents.length - 1]?.id ?? null
  }
  return { openDocument, saveDocument, reloadDocument, discardDocument }
}
