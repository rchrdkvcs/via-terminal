import { defineStore } from 'pinia'
import { reactive } from 'vue'
import { filesApi, type Listing, type RemoteEntry, type TransferEvent } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { documentActions, type RemoteDocument } from './file-documents'
export interface FileState {
  owner: string | undefined
  visible: boolean
  expanded: boolean
  directory: string
  entries: RemoteEntry[]
  documents: RemoteDocument[]
  activeDocument: string | null
  busy: boolean
  error: string | null
  generation: number
  sessionId: string | null
  transfers: TransferEvent[]
}
export const useFiles = defineStore('files', () => {
  const panels = reactive<Record<string, FileState>>({})
  function state(tabId: string): FileState {
    return (panels[tabId] ??= {
      owner: undefined,
      visible: false,
      expanded: false,
      directory: '.',
      entries: [],
      documents: [],
      activeDocument: null,
      busy: false,
      error: null,
      generation: 0,
      sessionId: null,
      transfers: [],
    })
  }
  async function navigate(tabId: string, sessionId: string, path: string) {
    const panel = state(tabId)
    const generation = ++panel.generation
    panel.busy = true
    panel.error = null
    panel.sessionId = sessionId
    try {
      const listing = await filesApi.request<Listing>(sessionId, { operation: 'list', path })
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
  function disconnect(tabId: string) {
    const panel = panels[tabId]
    if (!panel) return
    panel.generation++
    panel.sessionId = null
    panel.busy = false
    panel.transfers.forEach((job) => {
      if (job.state === 'running' || job.state === 'conflict')
        Object.assign(job, {
          state: 'failed',
          message: 'Connexion interrompue. Vous pouvez réessayer après reconnexion.',
        })
    })
  }
  function release(tabId: string) {
    disconnect(tabId)
    delete panels[tabId]
  }
  function hasChanges(tabId: string) {
    return state(tabId).documents.some((doc) => doc.content !== doc.original || doc.saving)
  }
  function hasTransfers(tabId: string) {
    return state(tabId).transfers.some((job) => ['running', 'conflict'].includes(job.state))
  }
  function transferEvent(tabId: string, event: TransferEvent) {
    const panel = panels[tabId]
    if (!panel) return
    if (panel.sessionId !== event.sessionId) return
    const transfer = panel.transfers.find((job) => job.id === event.id)
    if (transfer) Object.assign(transfer, event)
    else panel.transfers.push(event)
  }
  return {
    panels,
    state,
    navigate,
    disconnect,
    release,
    hasChanges,
    hasTransfers,
    transferEvent,
    ...documentActions(state),
  }
})
