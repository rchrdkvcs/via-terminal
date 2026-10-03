/**
 * One save at a time per vault record, shared by every editor. Editors are
 * remounted when the selection changes, so two of them can hold saves for the
 * same record; a single queue keeps those writes in the order they were asked
 * for. Queued snapshots are saved even after their editor has closed.
 */
import { clone } from '@/lib/clone'
import type { Id } from '@/ipc/types'

export type RecordKind = 'host' | 'group' | 'identity'

export type SaveOutcome<T> = { id: Id; submitted: T } | { id: null; cause?: unknown }

interface Request<T> {
  kind: RecordKind
  /** Consecutive requests from one owner coalesce into its latest snapshot. */
  owner: object
  input: T
  save: (input: T) => Promise<Id | null>
}

interface Entry {
  owner: object
  input: { id: Id | null }
  save: (input: never) => Promise<Id | null>
  waiters: Array<(outcome: SaveOutcome<never>) => void>
}

/** Existing records queue by kind and id; a creation queues by its owner. */
const queues = new Map<string | object, Entry[]>()

const KEEP = { action: 'keep' } as const

/**
 * `snapshot` once `submitted` is stored as `id`: it now targets that record,
 * and a password that was just sent is not sent again.
 */
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

/** Queue a snapshot; resolves once the save that includes it has finished. */
export function queueSave<T extends { id: Id | null }>(
  request: Request<T>,
): Promise<SaveOutcome<T>> {
  const key = request.input.id ? `${request.kind}:${request.input.id}` : request.owner
  return new Promise((resolve) => {
    const waiter = resolve as Entry['waiters'][number]
    const queue = queues.get(key)
    const last = queue?.[queue.length - 1]
    // The head is being saved; only a waiting entry can still change.
    if (queue && last && queue.length > 1 && last.owner === request.owner) {
      last.input = clone(request.input)
      last.waiters.push(waiter)
      return
    }
    const entry: Entry = { ...request, input: clone(request.input), waiters: [waiter] }
    if (queue) return void queue.push(entry)
    queues.set(key, [entry])
    void drain(key, request.kind)
  })
}

async function drain(key: string | object, kind: RecordKind) {
  const queue = queues.get(key)!
  let saved: SaveOutcome<Entry['input']> = { id: null }
  let stored: string | null = null
  while (queue.length) {
    const entry = queue[0]!
    // Already stored by the previous save, for instance a repeated creation.
    if (JSON.stringify(entry.input) !== stored) saved = await attempt(entry)
    queue.shift()
    for (const waiter of entry.waiters) waiter(saved as SaveOutcome<never>)
    if (!saved.id) {
      stored = null
      continue
    }
    const { id, submitted } = saved
    for (const next of queue) acknowledge(next.input, submitted, id)
    stored = JSON.stringify(acknowledge(clone(submitted), submitted, id))
    // A creation now has an id: later saves of that record queue behind it.
    const record = `${kind}:${id}`
    if (key !== record && !queues.has(record)) queues.set(record, queue)
  }
  for (const [name, value] of queues) if (value === queue) queues.delete(name)
}

async function attempt(entry: Entry): Promise<SaveOutcome<{ id: Id | null }>> {
  try {
    const id = await entry.save(clone(entry.input) as never)
    return id ? { id, submitted: entry.input } : { id: null }
  } catch (cause) {
    return { id: null, cause }
  }
}
