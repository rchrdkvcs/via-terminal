import { filesApi, type RemoteEntry } from '@/ipc/files'
import { describeError } from '@/ipc/client'
import { useFiles } from '@/stores/files'
import { explorerScope, reportError, type ExplorerContext } from './useFileOperations'
import { droppedFiles } from './dropFiles'
const STAGE_CHUNK = 256 * 1024
export function useFileTransfers(context: ExplorerContext) {
  const files = useFiles()
  async function upload(directory: boolean) {
    const scope = explorerScope(context)
    if (!scope.sessionId) return
    const destination = files.state(scope.tabId).directory
    try {
      const sources = await filesApi.pick(directory)
      if (sources.length && scope.current())
        await files.startTransfer(scope.tabId, scope.sessionId, {
          direction: 'upload',
          sources,
          destination,
        })
    } catch (cause) {
      reportError(scope.tabId, cause)
    }
  }
  async function download(entries: RemoteEntry[]) {
    const scope = explorerScope(context)
    if (!scope.sessionId) return
    try {
      const [destination] = await filesApi.pick(true, true)
      if (destination && scope.current())
        await files.startTransfer(scope.tabId, scope.sessionId, {
          direction: 'download',
          sources: entries.map((entry) => entry.path),
          destination,
        })
    } catch (cause) {
      reportError(scope.tabId, cause)
    }
  }
  /** Stages a drop as a visible, cancellable preparation, then uploads it. */
  async function drop(event: DragEvent) {
    const scope = explorerScope(context)
    if (!event.dataTransfer || !scope.sessionId) return
    const destination = files.state(scope.tabId).directory
    let dropped: Awaited<ReturnType<typeof droppedFiles>>
    try {
      dropped = await droppedFiles(event.dataTransfer)
    } catch (cause) {
      return reportError(scope.tabId, cause)
    }
    if (!dropped.length || !scope.current()) return
    const total = dropped.reduce((sum, { file }) => sum + (file?.size ?? 0), 0)
    const job = files.prepareTransfer(scope.tabId, scope.sessionId, destination, total)
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
    const scope = explorerScope(context)
    await files
      .cancelTransfer(scope.sessionId, id)
      .catch((cause) => reportError(scope.tabId, cause))
  }
  async function retry(id: string) {
    const scope = explorerScope(context)
    if (scope.sessionId) await files.retryTransfer(scope.tabId, scope.sessionId, id)
  }
  return {
    upload,
    download,
    drop,
    cancel,
    retry,
    clearFinished: () => files.clearFinishedTransfers(context.tabId()),
  }
}
