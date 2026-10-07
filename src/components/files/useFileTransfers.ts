import { filesApi, type RemoteEntry } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { useFiles } from '@/stores/files'
import { reportError, type ExplorerContext } from './useFileOperations'
import { droppedFiles } from './dropFiles'
const STAGE_CHUNK = 256 * 1024
export function useFileTransfers(context: ExplorerContext) {
  const files = useFiles()
  async function upload(directory: boolean) {
    const tabId = context.tabId(),
      link = files.connection(tabId)
    if (!link) return
    const destination = files.state(tabId).directory
    try {
      const sources = await filesApi.pick(directory)
      if (sources.length && link.current())
        await files.startTransfer(tabId, {
          direction: 'upload',
          sources,
          destination,
        })
    } catch (cause) {
      reportError(tabId, cause)
    }
  }
  async function download(entries: RemoteEntry[]) {
    const tabId = context.tabId(),
      link = files.connection(tabId)
    if (!link) return
    try {
      const [destination] = await filesApi.pick(true, true)
      if (destination && link.current())
        await files.startTransfer(tabId, {
          direction: 'download',
          sources: entries.map((entry) => entry.path),
          destination,
        })
    } catch (cause) {
      reportError(tabId, cause)
    }
  }
  /** Stages a drop as a visible, cancellable preparation, then uploads it. */
  async function drop(event: DragEvent) {
    const tabId = context.tabId(),
      link = files.connection(tabId)
    if (!event.dataTransfer || !link) return
    const destination = files.state(tabId).directory
    let dropped: Awaited<ReturnType<typeof droppedFiles>>
    try {
      dropped = await droppedFiles(event.dataTransfer)
    } catch (cause) {
      return reportError(tabId, cause)
    }
    if (!dropped.length || !link.current()) return
    const total = dropped.reduce((sum, { file }) => sum + (file?.size ?? 0), 0)
    const job = files.prepareTransfer(tabId, destination, total)
    if (!job) return
    try {
      const stagingId = await filesApi.stageBegin()
      if (!job.stage(stagingId)) return
      let copied = 0
      for (const { file, path } of dropped) {
        if (!job.active()) return
        if (!file) {
          await filesApi.stageDirectory(stagingId, path)
          continue
        }
        if (file.size === 0) await filesApi.stageChunk(stagingId, path, [])
        for (let offset = 0; offset < file.size && job.active(); offset += STAGE_CHUNK) {
          const data = new Uint8Array(await file.slice(offset, offset + STAGE_CHUNK).arrayBuffer())
          await filesApi.stageChunk(stagingId, path, Array.from(data))
          job.progress((copied += data.length))
        }
      }
      if (!job.active()) return
      await job.start(await filesApi.stageFinish(stagingId))
    } catch (cause) {
      job.fail(describeError(cause))
    }
  }
  async function cancel(id: string) {
    const tabId = context.tabId()
    await files.cancelTransfer(id).catch((cause) => reportError(tabId, cause))
  }
  const retry = (id: string) => files.retryTransfer(context.tabId(), id)
  return {
    upload,
    download,
    drop,
    cancel,
    retry,
    clearFinished: () => files.clearFinishedTransfers(context.tabId()),
  }
}
