/**
 * An editable copy of a vault record. Existing records save on blur or
 * change; new ones only when asked. A failed save keeps what the user typed
 * and exposes the backend's explanation.
 */
import { ref, watch, type Ref } from 'vue'
import { describeError } from '@/ipc/client'
import { clone } from '@/lib/clone'
import type { Id } from '@/ipc/types'

interface Options<T> {
  /** The record as the vault knows it, rebuilt on every change. */
  source: () => T
  save: (input: T) => Promise<Id | null>
  /** A reason the draft cannot be saved yet, in the user's words. */
  validate?: (input: T) => string | null
}

const KEEP = { action: 'keep' } as const

export function useDraft<T extends { id: Id | null }>({ source, save, validate }: Options<T>) {
  const draft = ref(clone(source())) as Ref<T>
  const error = ref<string | null>(null)
  const saving = ref(false)
  let baseline = JSON.stringify(draft.value)

  function reset() {
    draft.value = clone(source())
    baseline = JSON.stringify(draft.value)
    error.value = null
  }

  // Another record, or a change from elsewhere: follow it unless the user has
  // unsaved edits, which would otherwise be lost under their cursor.
  watch(
    () => JSON.stringify(source()),
    (next, previous) => {
      const otherRecord = JSON.parse(next).id !== JSON.parse(previous).id
      if (otherRecord || JSON.stringify(draft.value) === baseline) reset()
    },
  )

  /** Save now, whether or not the record exists yet. Resolves to its id. */
  async function commit(): Promise<Id | null> {
    const invalid = validate?.(draft.value) ?? null
    error.value = invalid
    if (invalid) return null
    saving.value = true
    try {
      const id = await save(clone(draft.value))
      // Secrets are sent once; the next save must not resend them.
      if ('password' in draft.value) Object.assign(draft.value, { password: KEEP })
      baseline = JSON.stringify(draft.value)
      return id
    } catch (cause) {
      error.value = describeError(cause)
      return null
    } finally {
      saving.value = false
    }
  }

  /** Save an existing record if something changed; drafts wait for "Enregistrer". */
  async function autosave() {
    if (draft.value.id && JSON.stringify(draft.value) !== baseline) await commit()
  }

  return { draft, error, saving, commit, autosave, reset }
}
