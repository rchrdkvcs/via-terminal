import { filesApi, type RemoteEntry } from '@/ipc/files'
import { useFiles } from '@/stores/files'
import { reportError, type ExplorerContext } from './useFileOperations'
import { droppedFiles } from './dropFiles'
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
  /** Hands a drop to the store, which stages it as a cancellable preparation, then uploads it. */
  async function drop(event: DragEvent) {
    const tabId = context.tabId(),
      link = files.connection(tabId)
    if (!event.dataTransfer || !link) return
    const destination = files.state(tabId).directory
    try {
      const dropped = await droppedFiles(event.dataTransfer)
      if (link.current()) await files.uploadDropped(tabId, destination, dropped)
    } catch (cause) {
      reportError(tabId, cause)
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
