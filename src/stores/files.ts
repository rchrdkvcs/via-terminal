import { defineStore } from 'pinia'
import { reactive, watch } from 'vue'
import { filesApi, type RemoteEntry, type RemoteOwner } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { useSessions } from './sessions'
import { documentActions, isDirty, type RemoteDocument } from './file-documents'
import { transferActions, type Transfer } from './file-transfers'
export type { RemoteDocument } from './file-documents'
export type { Transfer, TransferState } from './file-transfers'
export type { Preparation } from './file-preparation'
/** The remote explorer of one tab. */
export interface FileState {
  owner: RemoteOwner | undefined
  visible: boolean
  directory: string
  entries: RemoteEntry[]
  documents: RemoteDocument[]
  busy: boolean
  error: string | null
  transfers: Transfer[]
}
/**
 * A tab's ready session when a request began. Its replies apply only while `current()`:
 * the tab still exists and has not changed session since.
 */
export interface Connection {
  readonly sessionId: string
  current(): boolean
}
const empty = (): FileState => ({
  owner: undefined,
  visible: false,
  directory: '.',
  entries: [],
  documents: [],
  busy: false,
  error: null,
  transfers: [],
})
const ABSENT: Readonly<FileState> = Object.freeze(empty())
export const useFiles = defineStore('files', () => {
  const panels = reactive<Record<string, FileState>>({})
  const sessions = useSessions()
  /** One generation per explorer, renewed whenever its session changes or it is released. */
  const links = new Map<string, { sessionId: string | null; generation: number }>()
  const listings = new Map<string, symbol>()
  let generations = 0
  function session(tabId: string): string | null {
    const runtime = sessions.runtime(tabId)
    return runtime.state === 'ready' ? (runtime.sessionId ?? null) : null
  }
  function connection(tabId: string): Connection | null {
    const link = links.get(tabId)
    if (!panels[tabId] || !link?.sessionId) return null
    const { sessionId, generation } = link
    return { sessionId, current: () => links.get(tabId)?.generation === generation }
  }
  /** Reads an explorer without creating it; a released one reads as empty. */
  function state(tabId: string): Readonly<FileState> {
    return panels[tabId] ?? ABSENT
  }
  function ensure(tabId: string): FileState {
    if (!panels[tabId]) {
      links.set(tabId, { sessionId: session(tabId), generation: ++generations })
      panels[tabId] = empty()
    }
    return panels[tabId]
  }
  const transfers = transferActions(panels, connection)
  // Session ends and reconnections invalidate every reply still on its way.
  watch(
    () => Object.keys(panels).map((id) => [id, session(id)] as const),
    (current) => {
      for (const [id, sessionId] of current) {
        const link = links.get(id)
        if (!link || link.sessionId === sessionId) continue
        const ended = link.sessionId !== null
        links.set(id, { sessionId, generation: ++generations })
        if (!ended) continue
        panels[id].busy = false
        transfers.interrupt(id)
      }
    },
    { flush: 'sync' },
  )
  async function navigate(tabId: string, path: string) {
    const panel = ensure(tabId)
    const link = connection(tabId)
    if (!link) return
    const listing = Symbol()
    listings.set(tabId, listing)
    const latest = () => link.current() && listings.get(tabId) === listing
    panel.busy = true
    panel.error = null
    try {
      const reply = await filesApi.request(link.sessionId, { operation: 'list', path })
      if (!latest()) return
      panel.owner = reply.owner
      panel.directory = reply.path
      panel.entries = reply.entries
    } catch (cause) {
      if (latest()) panel.error = describeError(cause)
    } finally {
      if (latest()) panel.busy = false
    }
  }
  /** The tab closed or changed target: forgets everything, including staged drops. */
  function release(tabId: string) {
    if (!panels[tabId]) return
    links.delete(tabId)
    listings.delete(tabId)
    transfers.interrupt(tabId)
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
    session,
    connection,
    setVisible: (tabId: string, visible: boolean) => {
      ensure(tabId).visible = visible
    },
    hide: (tabId: string) => {
      if (panels[tabId]) panels[tabId].visible = false
    },
    navigate,
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
    ...documentActions({ panels, ensure, connection }),
  }
})
