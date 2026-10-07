import { reactive, shallowReactive } from 'vue'
import {
  filesApi,
  type Collision,
  type FileRequest,
  type RemoteOwner,
  type TransferDirection,
  type TransferEvent,
  type TransferPlan,
} from '@/ipc/files'
import { describeError } from '@/ipc/client'
import type { Connection, FileState } from './files'
/** `preparing` exists only here: a drop copied to local staging before its upload starts. */
export type TransferState = TransferEvent['state'] | 'preparing'
export interface Transfer {
  id: string
  sessionId: string
  /** A preparation is always an upload. */
  direction: TransferDirection
  state: TransferState
  path: string
  bytes: number
  total: number
  message: string | null
  skipped: string[]
  /** A failed transfer whose plan is kept for retry after reconnection. */
  retryable: boolean
}
/** A dropped file, or a directory when `file` is null, at its path inside the drop. */
export interface DroppedFile {
  path: string
  file: Blob | null
}
const ACTIVE: readonly TransferState[] = ['preparing', 'running', 'conflict']
export const isActive = (state: TransferState) => ACTIVE.includes(state)
export const isProgressing = (state: TransferState) => state === 'preparing' || state === 'running'
export const isFinished = (state: TransferState) => !isActive(state)
const INTERRUPTED = 'Connexion interrompue. Vous pouvez réessayer après reconnexion.'
const STAGE_CHUNK = 256 * 1024
/** One transfer: its visible state, and what it needs until it settles. */
interface Job {
  tabId: string
  connection: Connection | null
  transfer: Transfer
  /** Kept while the native side may still report on it or a retry may resend it. */
  plan?: TransferPlan
  stagingId?: string
}
type Plan = Omit<TransferPlan, 'id' | 'owner'> & { owner?: RemoteOwner }
export function transferActions(
  panels: Record<string, FileState>,
  connection: (tabId: string) => Connection | null,
) {
  const jobs = shallowReactive(new Map<string, Job>())
  const ofTab = (tabId: string) => [...jobs.values()].filter((job) => job.tabId === tabId)
  /** Lists a new transfer in an existing explorer. */
  function track(tabId: string, link: Connection | null, shown: Partial<Transfer>): Job | null {
    if (!panels[tabId]) return null
    const id = crypto.randomUUID()
    const transfer = reactive<Transfer>({
      id,
      sessionId: link?.sessionId ?? '',
      direction: 'upload',
      state: 'running',
      path: '',
      bytes: 0,
      total: 0,
      message: null,
      skipped: [],
      retryable: false,
      ...shown,
    })
    const job: Job = { tabId, connection: link, transfer }
    jobs.set(id, job)
    return job
  }
  /** Removes a drop's local staging, best effort. */
  function settle(job: Job) {
    if (job.stagingId) void filesApi.stageDiscard(job.stagingId).catch(() => undefined)
    job.stagingId = undefined
    job.plan = undefined
  }
  function end(job: Job, state: TransferState, message: string | null = null) {
    if (isFinished(job.transfer.state)) return
    const retryable = state === 'failed' && !!job.plan
    Object.assign(job.transfer, { state, message, retryable })
    if (!retryable) settle(job)
  }
  /** Starts with the explorer's owner unless the plan, being a retry, keeps its own. */
  async function send(job: Job, plan: Plan) {
    const { tabId, connection: link, transfer } = job
    const owner = plan.owner ?? panels[tabId]?.owner
    if (!owner) return end(job, 'failed', 'Ouvrez un dossier distant avant de transférer.')
    if (!link) return end(job, 'failed', INTERRUPTED)
    job.plan = { ...plan, owner, id: transfer.id }
    const { direction, destination: path } = plan
    Object.assign(transfer, { direction, state: 'running', path, message: null })
    try {
      await filesApi.request(link.sessionId, { operation: 'transfer', ...job.plan })
    } catch (cause) {
      if (link.current()) end(job, 'failed', describeError(cause))
    }
  }
  async function startTransfer(tabId: string, plan: Plan) {
    const job = track(tabId, connection(tabId), { direction: plan.direction })
    if (job) await send(job, plan)
  }
  /** Stages a drop locally as a visible, cancellable preparation, then uploads it. */
  async function uploadDropped(tabId: string, destination: string, dropped: DroppedFile[]) {
    const link = connection(tabId)
    if (!link || !dropped.length) return
    const total = dropped.reduce((sum, { file }) => sum + (file?.size ?? 0), 0)
    const job = track(tabId, link, { state: 'preparing', path: destination, total })!
    const active = () => job.transfer.state === 'preparing' && link.current()
    try {
      const stagingId = await filesApi.stageBegin()
      job.stagingId = stagingId
      if (!active()) return settle(job)
      for (const { file, path } of dropped) {
        if (!file) await filesApi.stageDirectory(stagingId, path)
        else if (!file.size) await filesApi.stageChunk(stagingId, path, new Uint8Array())
        for (let offset = 0; file && offset < file.size && active(); offset += STAGE_CHUNK) {
          const data = new Uint8Array(await file.slice(offset, offset + STAGE_CHUNK).arrayBuffer())
          await filesApi.stageChunk(stagingId, path, data)
          job.transfer.bytes += data.length
        }
        if (!active()) return
      }
      const sources = await filesApi.stageFinish(stagingId)
      if (active()) await send(job, { direction: 'upload', sources, destination })
    } catch (cause) {
      end(job, 'failed', describeError(cause))
    }
  }
  function transferEvent(event: TransferEvent) {
    const job = jobs.get(event.id)
    if (!job?.plan) return
    job.plan.completedSources = event.completedSources
    job.plan.directories = event.directories
    const { transfer } = job
    // A transfer already failed by a disconnection stays retryable whatever comes late,
    // but never loses a late native cleanup warning.
    if (transfer.state === 'failed') {
      if (event.message && isFinished(event.state))
        transfer.message = [transfer.message, event.message].filter(Boolean).join('\n')
      return
    }
    const { sessionId, direction, state, path, bytes, total, message, skipped } = event
    const retryable = state === 'failed'
    const shown = { sessionId, direction, state, path, bytes, total, message, skipped, retryable }
    Object.assign(transfer, shown)
    if (isFinished(state) && !retryable) settle(job)
  }
  /** Stops a preparation here, or asks the native side to cancel a transfer. */
  async function cancelTransfer(id: string) {
    const job = jobs.get(id)
    if (job?.transfer.state === 'preparing') return end(job, 'cancelled')
    const link = job?.connection
    if (link?.current()) await filesApi.request(link.sessionId, { operation: 'cancel', id })
  }
  /** Answers a collision, unless its connection ended while the question was open. */
  async function resolveTransfer(id: string, choice: Collision | 'cancel', all: boolean) {
    const link = jobs.get(id)?.connection
    if (!link?.current()) return
    const request: FileRequest =
      choice === 'cancel' ? { operation: 'cancel', id } : { operation: 'resolve', id, choice, all }
    await filesApi.request(link.sessionId, request).catch(() => undefined)
  }
  /** Resends a failed transfer as a new one, keeping its owner, progress and staging. */
  async function retryTransfer(tabId: string, id: string) {
    const failed = jobs.get(id)
    const link = connection(tabId)
    if (failed?.tabId !== tabId || failed.transfer.state !== 'failed' || !failed.plan || !link)
      return
    jobs.delete(id)
    const { owner, direction, sources, destination, completedSources, directories } = failed.plan
    const job = track(tabId, link, { direction })!
    job.stagingId = failed.stagingId
    await send(job, { owner, direction, sources, destination, completedSources, directories })
  }
  function interrupt(tabId: string) {
    for (const job of ofTab(tabId))
      if (isActive(job.transfer.state)) end(job, 'failed', INTERRUPTED)
  }
  /** The explorer closed: forgets its transfers and their staged drops. */
  function release(tabId: string) {
    for (const job of ofTab(tabId)) {
      settle(job)
      jobs.delete(job.transfer.id)
    }
  }
  function activeTransfers(tabId: string): string[] {
    return ofTab(tabId)
      .filter((job) => isActive(job.transfer.state))
      .map((job) => job.transfer.id)
  }
  function clearFinishedTransfers(tabId: string) {
    for (const { transfer } of ofTab(tabId))
      if (isFinished(transfer.state) && !transfer.retryable) jobs.delete(transfer.id)
  }
  return {
    interrupt,
    release,
    actions: {
      transfers: (tabId: string): Transfer[] => ofTab(tabId).map((job) => job.transfer),
      startTransfer,
      uploadDropped,
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
