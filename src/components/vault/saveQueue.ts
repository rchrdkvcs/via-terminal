import { clone } from '@/lib/clone'
import type { Id } from '@/ipc/types'

export type RecordKind = 'host' | 'group' | 'identity'

export type SaveOutcome<T> = { id: Id; submitted: T } | { id: null; cause?: unknown }

interface Request<T> {
  kind: RecordKind

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

const queues = new Map<string | object, Entry[]>()
const pending = new Set<Promise<SaveOutcome<unknown>>>()

/** Includes waiting snapshots whose backend call has not started yet. */
export async function flushVaultSaves() {
  while (pending.size) {
    const results = await Promise.all(pending)
    const failed = results.find((result) => !result.id)
    if (failed?.id === null)
      throw failed.cause ?? new Error('Une modification du coffre n’a pas pu être enregistrée.')
  }
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

export function queueSave<T extends { id: Id | null }>(
  request: Request<T>,
): Promise<SaveOutcome<T>> {
  const key = request.input.id ? `${request.kind}:${request.input.id}` : request.owner
  const operation = new Promise<SaveOutcome<T>>((resolve) => {
    const waiter = resolve as Entry['waiters'][number]
    const queue = queues.get(key)
    const last = queue?.[queue.length - 1]

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
  pending.add(operation)
  void operation.then(() => pending.delete(operation))
  return operation
}

async function drain(key: string | object, kind: RecordKind) {
  const queue = queues.get(key)!
  let saved: SaveOutcome<Entry['input']> = { id: null }
  let stored: string | null = null
  while (queue.length) {
    const entry = queue[0]!

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
