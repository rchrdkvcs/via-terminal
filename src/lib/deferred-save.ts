/** Debounced snapshots, serialized writes, and an awaited flush before exit. */
import { clone } from './clone'

export function deferredSave<T>(
  snapshot: () => T,
  write: (value: T) => Promise<unknown>,
  onError: (cause: unknown) => void,
  delay: number,
) {
  let revision = 0
  let saved = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending: Promise<void> | undefined

  async function drain() {
    while (saved !== revision) {
      const current = revision
      await write(clone(snapshot()))
      saved = current
    }
  }

  function flush(): Promise<void> {
    clearTimeout(timer)
    pending ??= drain().finally(() => {
      pending = undefined
    })
    return pending
  }

  function schedule() {
    revision++
    clearTimeout(timer)
    timer = setTimeout(() => void flush().catch(onError), delay)
  }

  return { schedule, flush }
}
