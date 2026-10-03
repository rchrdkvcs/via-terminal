import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { deferredBackend, editor, record } from '@/test/vaultSaves'

/** An editor that the test can close, as selecting another record does. */
function closable(...args: Parameters<typeof editor>) {
  const scope = effectScope()
  return { ...scope.run(() => editor(...args))!, close: () => scope.stop() }
}

// The vault page remounts its editor on every selection: A → B → A.
describe('useDraft saves shared between editors of one record', () => {
  it('saves a reopened editor after the closed one, in order', async () => {
    const backend = deferredBackend()
    const before = closable(record('a'), backend.save)
    before.draft.value.name = 'first'
    void before.commit()
    before.draft.value.name = 'queued'
    void before.autosave()
    before.close()
    const after = editor(record('a'), backend.save)
    after.draft.value.name = 'newest'
    const newest = after.autosave()
    expect(after.saving.value).toBe(true)
    await backend.settle('a')
    await backend.settle('a')
    expect(after.draft.value.name).toBe('newest')
    expect(after.saving.value).toBe(true)
    await backend.settle('a')
    await newest
    expect(backend.inputs().map((input) => input.name)).toEqual(['first', 'queued', 'newest'])
    expect(after.saving.value).toBe(false)
    await after.autosave()
    expect(backend.save).toHaveBeenCalledTimes(3)
  })

  it('keeps a queued password that the reopened editor does not show', async () => {
    const backend = deferredBackend()
    const before = closable(record('a'), backend.save)
    before.draft.value.name = 'first'
    void before.commit()
    before.draft.value.password = { action: 'set', value: 'secret' }
    void before.autosave()
    before.close()
    const after = editor(record('a'), backend.save)
    after.draft.value.name = 'newest'
    void after.autosave()
    await backend.settle('a')
    await backend.settle('a')
    await backend.settle('a')
    expect(backend.inputs().map((input) => input.password)).toEqual([
      { action: 'keep' },
      { action: 'set', value: 'secret' },
      { action: 'keep' },
    ])
  })

  it('updates a record created by a closed editor instead of creating it twice', async () => {
    const backend = deferredBackend()
    const creator = closable(record(null), backend.save)
    void creator.commit()
    creator.draft.value.name = 'renamed'
    void creator.commit()
    creator.close()
    await backend.settle('created')
    // The created record opens in its own editor while the queue still runs.
    const opened = editor(record('created'), backend.save)
    opened.draft.value.name = 'edited'
    const edited = opened.autosave()
    await backend.settle('created')
    await backend.settle('created')
    await edited
    expect(backend.inputs()).toEqual([
      record(null),
      record('created', 'renamed'),
      record('created', 'edited'),
    ])
  })

  it('lets other records save without waiting', async () => {
    const backend = deferredBackend()
    const first = editor(record('a'), backend.save)
    const second = editor(record('b'), backend.save)
    first.draft.value.name = 'a1'
    void first.autosave()
    second.draft.value.name = 'b1'
    const other = second.autosave()
    expect(backend.inputs().map((input) => input.id)).toEqual(['a', 'b'])
    backend.calls[1]!.resolve('b')
    await other
    expect(second.saving.value).toBe(false)
    await backend.settle('a')
  })
})
