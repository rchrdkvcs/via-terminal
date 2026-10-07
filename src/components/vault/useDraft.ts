import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from 'vue'
import { describeError } from '@/ipc/client'
import { clone } from '@/lib/clone'
import type { Id } from '@/ipc/types'
import { useVault } from '@/stores/vault'
import { acknowledge, type RecordKind } from '@/stores/vault-saves'
import { registerDraftPreparation } from '@/updates/drafts'

interface Options<T> {
  kind: RecordKind

  source: () => T

  validate?: (input: T) => string | null
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export function useDraft<T extends { id: Id | null }>({ kind, source, validate }: Options<T>) {
  const vault = useVault()
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
      const incoming = JSON.parse(next) as T
      const otherRecord = incoming.id !== draft.value.id
      if (otherRecord || (!saving.value && JSON.stringify(draft.value) === baseline)) reset()
      else if (!saving.value) merge(incoming)
    },
    { flush: 'sync' },
  )

  /** Takes outside changes into the fields the user has not edited. */
  function merge(incoming: T) {
    const base = JSON.parse(baseline) as T
    adopt(base, incoming)
    baseline = JSON.stringify(base)
  }

  function adopt(base: T, incoming: T) {
    const fields = draft.value as Record<string, unknown>
    const before = base as Record<string, unknown>
    for (const [field, value] of Object.entries(incoming)) {
      if (same(value, before[field]) || !same(fields[field], before[field])) continue
      fields[field] = clone(value)
      before[field] = clone(value)
    }
  }

  async function commit(): Promise<Id | null> {
    const input = clone(draft.value)
    const ticket = ++latest
    const invalid = validate?.(input) ?? null
    error.value = invalid
    if (invalid) return null
    const owner = generation
    inFlight++
    saving.value = true
    const outcome = await vault.save(kind, owner, input)
    if (owner !== generation) return null
    saving.value = --inFlight > 0
    if (outcome.id) {
      adopt(clone(input), outcome.submitted)
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

  if (getCurrentScope()) {
    const unregister = registerDraftPreparation(async () => {
      if (JSON.stringify(draft.value) === baseline) return
      if (!draft.value.id)
        throw new Error(
          'Enregistrez ou annulez le nouveau brouillon du coffre avant la mise à jour.',
        )
      if (!(await commit()))
        throw new Error(error.value ?? 'Le brouillon du coffre n’a pas pu être enregistré.')
    })
    onScopeDispose(unregister)
  }

  return { draft, error, saving, commit, autosave, reset }
}
