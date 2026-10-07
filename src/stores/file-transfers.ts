import {
  filesApi,
  type Collision,
  type FileRequest,
  type RemoteOwner,
  type TransferEvent,
  type TransferPlan,
} from '@/ipc/files'
import { describeError } from '@/ipc/client'
import type { Connection, FileState } from './files'
import { preparation } from './file-preparation'
import {
  isActive,
  isFinished,
  discard,
  type Tracked,
  type Transfer,
  type TransferState,
} from './file-transfer-model'
export type { Transfer, TransferState } from './file-transfer-model'
const INTERRUPTED = 'Connexion interrompue. Vous pouvez réessayer après reconnexion.'
export function transferActions(
  panels: Record<string, FileState>,
  connection: (tabId: string) => Connection | null,
) {
  // Plans outlive their list item: a released tab's transfer still settles its staging.
  const tracked = new Map<string, Tracked>()
  function show(tabId: string, id: string, patch: Partial<Transfer>) {
    const panel = panels[tabId]
    const shown = panel?.transfers.find((job) => job.id === id)
    if (shown) Object.assign(shown, patch)
    else if (panel && patch.sessionId)
      panel.transfers.push({
        id,
        direction: 'upload',
        state: 'running',
        path: '',
        bytes: 0,
        total: 0,
        message: null,
        skipped: [],
        retryable: false,
        sessionId: patch.sessionId,
        ...patch,
      })
  }
  function settle(id: string) {
    void discard(tracked.get(id)?.stagingId)
    tracked.delete(id)
  }
  function end(id: string, state: TransferState, message: string | null = null) {
    const job = tracked.get(id)
    if (!job) return
    const retryable = state === 'failed' && !!job.plan && !!panels[job.tabId]
    job.state = state
    show(job.tabId, id, { state, message, retryable })
    if (!retryable) settle(id)
  }
  /** Starts with the explorer's owner unless the plan, being a retry, keeps its own. */
  async function startTransfer(
    tabId: string,
    plan: Omit<TransferPlan, 'id' | 'owner'> & { owner?: RemoteOwner },
    options: { id?: string; stagingId?: string } = {},
  ) {
    const panel = panels[tabId]
    const id = options.id ?? crypto.randomUUID()
    const owner = plan.owner ?? panel?.owner
    const link = connection(tabId)
    tracked.set(id, { tabId, connection: link, stagingId: options.stagingId, state: 'running' })
    if (!panel || !owner) return end(id, 'failed', 'Ouvrez un dossier distant avant de transférer.')
    if (!link) return end(id, 'failed', INTERRUPTED)
    const full: TransferPlan = { ...plan, owner, id }
    tracked.get(id)!.plan = full
    const { direction, destination: path } = plan
    const { sessionId } = link
    show(tabId, id, { sessionId, direction, state: 'running', path, message: null })
    try {
      await filesApi.request(sessionId, { operation: 'transfer', ...full })
    } catch (cause) {
      if (link.current()) end(id, 'failed', describeError(cause))
    }
  }
  function transferEvent(event: TransferEvent) {
    const job = tracked.get(event.id)
    if (job?.plan) {
      job.plan.completedSources = event.completedSources
      job.plan.directories = event.directories
    }
    // A transfer already failed by a disconnection stays retryable whatever comes late.
    if (!job?.plan) return
    if (job.state === 'failed') {
      // Retain retry state, but never lose late native cleanup warnings.
      const panel = panels[job.tabId]
      const shown = panel?.transfers.find((transfer) => transfer.id === event.id)
      if (shown && event.message && isFinished(event.state))
        shown.message = [shown.message, event.message].filter(Boolean).join('\n')
      return
    }
    job.state = event.state
    if (job.connection?.current()) {
      const { sessionId, direction, state, path, bytes, total, message, skipped } = event
      const retryable = state === 'failed'
      const patch = { sessionId, direction, state, path, bytes, total, message, skipped }
      show(job.tabId, event.id, { ...patch, retryable })
    }
    if (isFinished(event.state))
      if (event.state !== 'failed' || !panels[job.tabId]) settle(event.id)
  }
  /** Stops a preparation here, or asks the native side to cancel a transfer. */
  async function cancelTransfer(id: string) {
    const job = tracked.get(id)
    if (job?.state === 'preparing') return end(id, 'cancelled')
    const link = job?.connection
    if (link?.current()) await filesApi.request(link.sessionId, { operation: 'cancel', id })
  }
  /** Answers a collision, unless its connection ended while the question was open. */
  async function resolveTransfer(id: string, choice: Collision | 'cancel', all: boolean) {
    const link = tracked.get(id)?.connection
    if (!link?.current()) return
    const request: FileRequest =
      choice === 'cancel' ? { operation: 'cancel', id } : { operation: 'resolve', id, choice, all }
    await filesApi.request(link.sessionId, request).catch(() => undefined)
  }
  async function retryTransfer(tabId: string, id: string) {
    const job = tracked.get(id)
    if (job?.tabId !== tabId || job.state !== 'failed' || !job.plan || !connection(tabId)) return
    tracked.delete(id)
    const panel = panels[tabId]
    if (panel) panel.transfers = panel.transfers.filter((shown) => shown.id !== id)
    const { owner, direction, sources, destination, completedSources, directories } = job.plan
    const plan = { owner, direction, sources, destination, completedSources, directories }
    await startTransfer(tabId, plan, { stagingId: job.stagingId })
  }
  function interrupt(tabId: string) {
    for (const [id, job] of tracked)
      if (job.tabId === tabId && isActive(job.state)) end(id, 'failed', INTERRUPTED)
  }
  function forget(tabId: string) {
    for (const [id, job] of tracked)
      if (job.tabId === tabId && (!isActive(job.state) || job.state === 'preparing')) settle(id)
  }
  function activeTransfers(tabId: string): string[] {
    return (panels[tabId]?.transfers ?? [])
      .filter((job) => isActive(job.state))
      .map((job) => job.id)
  }
  function clearFinishedTransfers(tabId: string) {
    const panel = panels[tabId]
    if (panel)
      panel.transfers = panel.transfers.filter((job) => isActive(job.state) || job.retryable)
  }
  return {
    interrupt,
    forget,
    actions: {
      startTransfer,
      prepareTransfer: preparation({ panels, connection, tracked, show, end, startTransfer }),
      transferEvent,
      cancelTransfer,
      resolveTransfer,
      retryTransfer,
      activeTransfers,
      hasTransfers: (tabId: string) => activeTransfers(tabId).length > 0,
      clearFinishedTransfers,
    },
  }
}
