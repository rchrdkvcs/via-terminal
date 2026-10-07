import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { filesApi, type RemoteEntry, type RemoteOwner } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { documentActions, isDirty, type RemoteDocument } from './file-documents'
import { transferActions, type Transfer } from './file-transfers'
export type { RemoteDocument } from './file-documents'
export type { Transfer, TransferState } from './file-transfers'
export type { Preparation } from './file-preparation'
/** The remote explorer of one tab. Its connection is `sessionId`, null while disconnected. */
export interface FileState {
  owner: RemoteOwner | undefined
  visible: boolean
  directory: string
  entries: RemoteEntry[]
  documents: RemoteDocument[]
  busy: boolean
  error: string | null
  generation: number
  /** Invalidates document reads on disconnect, independently of directory refreshes. */
  connectionGeneration: number
  sessionId: string | null
  transfers: Transfer[]
}
export const useFiles = defineStore('files', () => {
  const panels = reactive<Record<string, FileState>>({})
  function state(tabId: string): FileState {
    return (panels[tabId] ??= {
      owner: undefined,
      visible: false,
      directory: '.',
      entries: [],
      documents: [],
      busy: false,
      error: null,
      generation: 0,
      connectionGeneration: 0,
      sessionId: null,
      transfers: [],
    })
  }
  const transfers = transferActions(panels)
  async function navigate(tabId: string, sessionId: string, path: string) {
    const panel = state(tabId)
    const generation = ++panel.generation
    panel.busy = true
    panel.error = null
    panel.sessionId = sessionId
    try {
      const listing = await filesApi.request(sessionId, { operation: 'list', path })
      if (panel.generation !== generation) return
      panel.owner = listing.owner
      panel.directory = listing.path
      panel.entries = listing.entries
    } catch (cause) {
      if (panel.generation === generation) panel.error = describeError(cause)
    } finally {
      if (panel.generation === generation) panel.busy = false
    }
  }
  /** The session ended: keeps documents and failed transfers for a later connection. */
  function disconnect(tabId: string) {
    const panel = panels[tabId]
    if (!panel) return
    panel.generation++
    panel.connectionGeneration++
    panel.sessionId = null
    panel.busy = false
    transfers.interrupt(tabId)
  }
  /** The tab closed or changed target: forgets everything, including staged drops. */
  function release(tabId: string) {
    disconnect(tabId)
    transfers.forget(tabId)
    delete panels[tabId]
  }
  function unsaved(tabId: string): RemoteDocument[] {
    return panels[tabId]?.documents.filter(isDirty) ?? []
  }
  function hasChanges(tabId: string) {
    return !!panels[tabId]?.documents.some((doc) => isDirty(doc) || doc.saving)
  }
  return {
    panels,
    state,
    setVisible: (tabId: string, visible: boolean) => {
      state(tabId).visible = visible
    },
    hide: (tabId: string) => {
      if (panels[tabId]) panels[tabId].visible = false
    },
    navigate,
    disconnect,
    release,
    unsaved,
    hasChanges,
    reportError: (tabId: string, error: string) => {
      if (panels[tabId]) panels[tabId].error = error
    },
    dismissError: (tabId: string) => {
      if (panels[tabId]) panels[tabId].error = null
    },
    ...transfers.actions,
    ...documentActions(state),
  }
})
