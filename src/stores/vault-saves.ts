import { clone } from '@/lib/clone'
import type { Id } from '@/ipc/types'

export type RecordKind = 'host' | 'group' | 'identity'

export type SaveOutcome<T> =
  | { id: Id; submitted: T }
  | { id: null; cause?: unknown; canceled?: true }

type Input = { id: Id | null } & Record<string, unknown>

interface Entry {
  owner: object
  input: Input
  patch?: (latest: Input) => Input
  waiters: Array<(outcome: SaveOutcome<never>) => void>
}

interface Backend {
  save: (kind: RecordKind, input: Input) => Promise<Id | null>
  /** The stored version of a record, shaped like an editor input. */
  current: (kind: RecordKind, id: Id) => Input | undefined
}

const KEEP = { action: 'keep' } as const

export function acknowledge<T extends { id: Id | null }>(snapshot: T, submitted: T, id: Id): T {
  snapshot.id = id
  if (
    'password' in snapshot &&
    'password' in submitted &&
    JSON.stringify(snapshot.password) === JSON.stringify(submitted.password)
  )
    Object.assign(snapshot, { password: KEEP })
  return snapshot
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** Saves each record one request at a time; patches apply to its latest version. */
export function createVaultSaves({ save, current }: Backend) {
  const queues = new Map<string | object, Entry[]>()
  const pending = new Set<Promise<SaveOutcome<unknown>>>()

  /** Includes waiting snapshots whose backend call has not started yet. */
  async function flush() {
    while (pending.size) {
      const results = await Promise.all(pending)
      const failed = results.find((result) => !result.id && !('canceled' in result))
      if (failed?.id === null)
        throw failed.cause ?? new Error('Une modification du coffre n’a pas pu être enregistrée.')
    }
  }

  function enqueue<T>(
    kind: RecordKind,
    key: string | object,
    entry: Omit<Entry, 'waiters'>,
  ): Promise<SaveOutcome<T>> {
    const operation = new Promise<SaveOutcome<T>>((resolve) => {
      const waiter = resolve as Entry['waiters'][number]
      const queue = queues.get(key)
      const last = queue?.[queue.length - 1]

      if (queue && last && queue.length > 1 && last.owner === entry.owner && !last.patch) {
        last.input = entry.input
        last.waiters.push(waiter)
        return
      }
      const added: Entry = { ...entry, waiters: [waiter] }
      if (queue) return void queue.push(added)
      queues.set(key, [added])
      void drain(key, kind)
    })
    pending.add(operation)
    void operation.then(() => pending.delete(operation))
    return operation
  }

  function queue<T extends { id: Id | null }>(
    kind: RecordKind,
    owner: object,
    input: T,
  ): Promise<SaveOutcome<T>> {
    const key = input.id ? `${kind}:${input.id}` : owner
    return enqueue(kind, key, { owner, input: clone(input) as unknown as Input })
  }

  function patch<T extends { id: Id | null }>(
    kind: RecordKind,
    id: Id,
    change: (latest: T) => T,
  ): Promise<SaveOutcome<T>> {
    const apply = change as unknown as (latest: Input) => Input
    return enqueue(kind, `${kind}:${id}`, { owner: {}, input: { id }, patch: apply })
  }

  /** Resolves once every save queued so far for the record has settled. */
  function settled(kind: RecordKind, id: Id): Promise<void> {
    const queue = queues.get(`${kind}:${id}`)
    const last = queue?.[queue.length - 1]
    if (!last) return Promise.resolve()
    return new Promise((resolve) => last.waiters.push(() => resolve()))
  }

  /** Drops the record's waiting saves; the one already sent still settles. */
  function cancel(kind: RecordKind, id: Id): Promise<void> {
    const queue = queues.get(`${kind}:${id}`)
    for (const entry of queue?.splice(1) ?? [])
      for (const waiter of entry.waiters) waiter({ id: null, canceled: true })
    return settled(kind, id)
  }

  async function drain(key: string | object, kind: RecordKind) {
    const queue = queues.get(key)!
    let saved: SaveOutcome<Input> = { id: null }
    let stored: string | null = null
    while (queue.length) {
      const entry = queue[0]!
      const base = entry.patch && latest(kind, entry.input.id, stored)
      if (entry.patch) entry.input = base ? entry.patch(clone(base)) : entry.input

      if (entry.patch && !base) saved = { id: null }
      else if (JSON.stringify(entry.input) !== stored) saved = await attempt(kind, entry)
      queue.shift()
      for (const waiter of entry.waiters) waiter(saved as SaveOutcome<never>)
      if (!saved.id) {
        stored = null
        continue
      }
      const { id, submitted } = saved
      for (const next of queue) {
        if (base && !next.patch) rebase(next.input, base, submitted)
        acknowledge(next.input, submitted, id)
      }
      stored = JSON.stringify(acknowledge(clone(submitted), submitted, id))

      const record = `${kind}:${id}`
      if (key !== record && !queues.has(record)) queues.set(record, queue)
    }
    for (const [name, value] of queues) if (value === queue) queues.delete(name)
  }

  function latest(kind: RecordKind, id: Id | null, stored: string | null): Input | undefined {
    if (stored) return JSON.parse(stored) as Input
    return id ? current(kind, id) : undefined
  }

  async function attempt(kind: RecordKind, entry: Entry): Promise<SaveOutcome<Input>> {
    try {
      const id = await save(kind, clone(entry.input))
      return id ? { id, submitted: entry.input } : { id: null }
    } catch (cause) {
      return { id: null, cause }
    }
  }

  return { queue, patch, settled, cancel, flush }
}

/** Carries a patched field into a queued snapshot that still holds its previous value. */
function rebase(input: Input, base: Input, patched: Input) {
  for (const field of Object.keys(patched))
    if (!same(patched[field], base[field]) && same(input[field], base[field]))
      input[field] = clone(patched[field])
}
