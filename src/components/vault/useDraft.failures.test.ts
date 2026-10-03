import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { deferredBackend, editor, record } from '@/test/vaultSaves'

const failures = [
  ['rejected', new Error('Adresse invalide')],
  ['unanswered', null],
] as const

describe('useDraft failed saves', () => {
  it.each(failures)('still sends a correction queued behind a %s save', async (_, failure) => {
    const backend = deferredBackend()
    const { draft, commit, autosave, error, saving } = editor(record('a'), backend.save)
    draft.value.name = 'wrong'
    const first = commit()
    draft.value.name = 'corrected'
    const correction = autosave()
    await backend.settle(failure)
    expect(await first).toBeNull()
    // The failure concerns a version the user has already replaced.
    expect(error.value).toBeNull()
    expect(saving.value).toBe(true)
    expect(backend.last()).toEqual({ ...record('a'), name: 'corrected' })
    await backend.settle('a')
    await correction
    expect(saving.value).toBe(false)
    await autosave()
    expect(backend.save).toHaveBeenCalledTimes(2)
  })

  it.each(failures)(
    'sends a correction queued behind a %s save after the editor closes',
    async (_, failure) => {
      const backend = deferredBackend()
      const scope = effectScope()
      const { draft, commit, autosave, error } = scope.run(() => editor(record('a'), backend.save))!
      draft.value.name = 'wrong'
      void commit()
      draft.value.name = 'corrected'
      const correction = autosave()
      scope.stop()
      await backend.settle(failure)
      expect(backend.last()).toEqual({ ...record('a'), name: 'corrected' })
      await backend.settle('a')
      await correction
      expect(error.value).toBeNull()
      expect(backend.save).toHaveBeenCalledTimes(2)
    },
  )

  it('rejects an invalid draft at once and still sends its later correction', async () => {
    const backend = deferredBackend()
    const scope = effectScope()
    const { draft, commit, autosave, error } = scope.run(() => editor(record('a'), backend.save))!
    draft.value.name = 'valid'
    void commit()
    draft.value.name = ''
    expect(await commit()).toBeNull()
    expect(error.value).toBe('Ajoutez un nom.')
    draft.value.name = 'corrected'
    const correction = autosave()
    expect(error.value).toBeNull()
    scope.stop()
    await backend.settle('a')
    expect(backend.inputs().map((input) => input.name)).toEqual(['valid', 'corrected'])
    await backend.settle('a')
    await correction
  })

  it('shows the failure of the latest request and does not retry it', async () => {
    const backend = deferredBackend()
    const { draft, commit, autosave, error } = editor(record('a'), backend.save)
    draft.value.name = 'first'
    void commit()
    draft.value.name = 'second'
    const latest = autosave()
    await backend.settle(new Error('old failure'))
    expect(error.value).toBeNull()
    await backend.settle(new Error('Hôte injoignable'))
    await latest
    expect(error.value).toBe('Hôte injoignable.')
    expect(draft.value.name).toBe('second')
    expect(backend.save).toHaveBeenCalledTimes(2)
  })
})
