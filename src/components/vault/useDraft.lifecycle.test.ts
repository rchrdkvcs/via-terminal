import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { deferredBackend, editor, record } from '@/test/vaultSaves'

describe('useDraft editor lifecycle', () => {
  it.each(['resolve', 'reject'] as const)(
    'ignores an old %s after selecting another record',
    async (finish) => {
      const backend = deferredBackend()
      const { stored, draft, commit, saving, error } = editor(record('a'), backend.save)
      draft.value.name = 'pending'
      const old = commit()
      stored.value = record('b', 'other')
      draft.value.name = 'changed'
      const current = commit()

      expect(backend.inputs().map((input) => input.id)).toEqual(['a', 'b'])
      await backend.settle(finish === 'resolve' ? 'a' : new Error('old failure'))
      expect(await old).toBeNull()
      expect(draft.value).toEqual({ ...record('b'), name: 'changed' })
      expect(error.value).toBeNull()
      expect(saving.value).toBe(true)
      await backend.settle('b')
      await current
      expect(saving.value).toBe(false)
    },
  )

  it('invalidates pending creation after an explicit reset', async () => {
    const backend = deferredBackend()
    const { commit, reset, draft } = editor(record(null), backend.save)
    const creating = commit()
    reset()
    await backend.settle('created')
    expect(await creating).toBeNull()
    expect(draft.value.id).toBeNull()
  })

  it.each(['selection', 'disposal'] as const)(
    'persists explicitly queued edits after %s',
    async (end) => {
      const backend = deferredBackend()
      const scope = effectScope()
      const { stored, draft, commit, autosave, saving, error } = scope.run(() =>
        editor(record('a'), backend.save),
      )!
      draft.value.name = 'first'
      const committing = commit()
      draft.value.name = 'queued'
      const queued = autosave()
      draft.value.name = 'uncommitted'
      if (end === 'selection') stored.value = record('b', 'other')
      else scope.stop()
      expect(saving.value).toBe(false)
      await backend.settle('a')
      expect(backend.last()).toEqual({ ...record('a'), name: 'queued' })
      await backend.settle('a')
      expect(await committing).toBeNull()
      await queued
      expect(error.value).toBeNull()
      expect(draft.value.name).toBe(end === 'selection' ? 'other' : 'uncommitted')
      scope.stop()
    },
  )
})
