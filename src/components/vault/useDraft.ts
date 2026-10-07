import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'
import { describeError } from '@/ipc/client'
import { clone } from '@/lib/clone'
import type { Id } from '@/ipc/types'
import { acknowledge, queueSave, type RecordKind } from './saveQueue'

interface Options<T> {
  kind: RecordKind

  source: () => T
  save: (input: T) => Promise<Id | null>

  validate?: (input: T) => string | null
}

export function useDraft<T extends { id: Id | null }>({
  kind,
  source,
  save,
  validate,
}: Options<T>) {
  const draft = ref(clone(source())) as Ref<T>
  const error = ref<string | null>(null)
  const saving = ref(false)
  let baseline = JSON.stringify(draft.value)

  let generation = {}
  let inFlight = 0
  let latest = 0

  function invalidate() {
    generation = {}
    inFlight = 0
    saving.value = false
  }

  if (getCurrentScope()) onScopeDispose(invalidate)

  function reset() {
    invalidate()
    draft.value = clone(source())
    baseline = JSON.stringify(draft.value)
    error.value = null
  }

  watch(
    () => JSON.stringify(source()),
    (next) => {
      const otherRecord = JSON.parse(next).id !== draft.value.id
      if (otherRecord || (!saving.value && JSON.stringify(draft.value) === baseline)) reset()
    },
    { flush: 'sync' },
  )

  async function commit(): Promise<Id | null> {
    const input = clone(draft.value)
    const ticket = ++latest
    const invalid = validate?.(input) ?? null
    error.value = invalid
    if (invalid) return null
    const owner = generation
    inFlight++
    saving.value = true
    const outcome = await queueSave({ kind, owner, input, save })
    if (owner !== generation) return null
    saving.value = --inFlight > 0
    if (outcome.id) {
      acknowledge(draft.value, outcome.submitted, outcome.id)
      baseline = JSON.stringify(
        acknowledge(clone(outcome.submitted), outcome.submitted, outcome.id),
      )
    }
    if (ticket === latest) error.value = 'cause' in outcome ? describeError(outcome.cause) : null
    if (!outcome.id) return null

    if (!input.id && JSON.stringify(draft.value) !== baseline) return commit()
    return outcome.id
  }

  async function autosave() {
    if (draft.value.id && JSON.stringify(draft.value) !== baseline) await commit()
  }

  return { draft, error, saving, commit, autosave, reset }
}
