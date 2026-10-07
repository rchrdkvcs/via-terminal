import { filesApi, type RemoteEntry, type TransferEvent } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { useFiles } from '@/stores/files'
import type { ExplorerContext } from './useFileOperations'
import { droppedFiles } from './dropFiles'
export interface TransferPlan {
  owner?: string
  directories?: Record<string, string>
  completedSources?: string[]
  direction: 'upload' | 'download'
  sources: string[]
  destination: string
  stagingId?: string
}
export const transferPlans = new Map<
  string,
  { tabId: string; plan: TransferPlan; state: TransferEvent['state'] }
>()
export function useFileTransfers(context: ExplorerContext) {
  const files = useFiles()
  async function start(plan: TransferPlan) {
    const tabId = context.tabId(),
      sessionId = context.sessionId()
    if (!sessionId || !plan.sources.length) return
    plan.owner ??= files.state(tabId).owner
    const id = crypto.randomUUID()
    transferPlans.set(id, { tabId, plan, state: 'running' })
    files.state(tabId).sessionId = sessionId
    files.transferEvent(tabId, {
      id,
      sessionId,
      state: 'running',
      path: plan.destination,
      bytes: 0,
      total: 0,
      message: null,
      skipped: [],
    })
    try {
      await filesApi.request(sessionId, { operation: 'transfer', id, ...plan })
    } catch (cause) {
      const saved = transferPlans.get(id)
      if (saved) saved.state = 'failed'
      if (!files.panels[tabId]) {
        if (plan.stagingId) await filesApi.stageDiscard(plan.stagingId).catch(() => undefined)
        transferPlans.delete(id)
        return
      }
      files.transferEvent(tabId, {
        id,
        sessionId,
        state: 'failed',
        path: plan.destination,
        bytes: 0,
        total: 0,
        message: describeError(cause),
        skipped: [],
      })
    }
  }
  async function upload(directory: boolean) {
    const tabId = context.tabId(),
      sessionId = context.sessionId(),
      panel = files.state(tabId),
      destination = panel.directory
    try {
      const sources = await filesApi.pick(directory)
      if (tabId !== context.tabId() || sessionId !== context.sessionId()) return
      await start({ direction: 'upload', sources, destination })
    } catch (cause) {
      panel.error = describeError(cause)
    }
  }
  async function download(entries: RemoteEntry[]) {
    const tabId = context.tabId(),
      panel = files.state(tabId),
      sessionId = context.sessionId()
    try {
      const destinations = await filesApi.pick(true, true)
      if (!destinations.length || tabId !== context.tabId() || sessionId !== context.sessionId())
        return
      await start({
        direction: 'download',
        sources: entries.map((entry) => entry.path),
        destination: destinations[0],
      })
    } catch (cause) {
      panel.error = describeError(cause)
    }
  }
  async function drop(event: DragEvent) {
    const tabId = context.tabId(),
      sessionId = context.sessionId(),
      panel = files.state(tabId),
      destination = panel.directory
    if (!event.dataTransfer || !sessionId) return
    let stagingId: string | undefined
    panel.busy = true
    try {
      const dropped = await droppedFiles(event.dataTransfer)
      if (!dropped.length) return
      stagingId = await filesApi.stageBegin()
      for (const { file, path } of dropped) {
        if (!file) {
          await filesApi.stageDirectory(stagingId, path)
          continue
        }
        if (file.size === 0) await filesApi.stageChunk(stagingId, path, [])
        for (let offset = 0; offset < file.size; offset += 256 * 1024) {
          const data = new Uint8Array(await file.slice(offset, offset + 256 * 1024).arrayBuffer())
          await filesApi.stageChunk(stagingId, path, Array.from(data))
        }
      }
      if (tabId !== context.tabId() || sessionId !== context.sessionId()) {
        await filesApi.stageDiscard(stagingId)
        return
      }
      const sources = await filesApi.stageFinish(stagingId)
      await start({ direction: 'upload', sources, destination, stagingId })
    } catch (cause) {
      panel.error = describeError(cause)
      if (stagingId) await filesApi.stageDiscard(stagingId).catch(() => undefined)
    } finally {
      panel.busy = false
    }
  }
  async function cancel(id: string) {
    const session = context.sessionId()
    if (session)
      await filesApi.request(session, { operation: 'cancel', id }).catch((cause) => {
        files.state(context.tabId()).error = describeError(cause)
      })
  }
  async function retry(id: string) {
    const saved = transferPlans.get(id)
    if (saved?.tabId === context.tabId()) {
      await start(saved.plan)
      transferPlans.delete(id)
      const panel = files.panels[saved.tabId]
      if (panel) panel.transfers = panel.transfers.filter((job) => job.id !== id)
    }
  }
  return { upload, download, drop, cancel, retry }
}
