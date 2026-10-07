import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferredBackend, editor, record } from '@/test/vaultSaves'

beforeEach(() => setActivePinia(createPinia()))

describe('useDraft concurrent saves', () => {
  it('acknowledges the submitted fields and preserves a later password', async () => {
    const backend = deferredBackend()
    const { draft, commit, autosave } = editor(record('a'), backend.save)
    draft.value.password = { action: 'set', value: 'first' }
    const committing = commit()
    draft.value.name = 'later'
    draft.value.password = { action: 'set', value: 'second' }
    await backend.settle('a')
    await committing
    expect(draft.value.password).toEqual({ action: 'set', value: 'second' })
    const autosaving = autosave()
    expect(backend.last()).toEqual({
      id: 'a',
      name: 'later',
      password: { action: 'set', value: 'second' },
    })
    await backend.settle('a')
    await autosaving
    await autosave()
    expect(backend.save).toHaveBeenCalledTimes(2)
  })

  it('coalesces pending requests into one subsequent write of the latest draft', async () => {
    const backend = deferredBackend()
    const { draft, commit, autosave, saving } = editor(record('a'), backend.save)
    draft.value.name = 'first'
    const committing = commit()
    draft.value.name = 'second'
    const savingSecond = autosave()
    draft.value.name = 'third'
    const savingThird = autosave()
    expect(backend.save).toHaveBeenCalledTimes(1)
    await backend.settle('a')
    expect(backend.inputs().map((input) => input.name)).toEqual(['first', 'third'])
    expect(saving.value).toBe(true)
    await backend.settle('a')
    await Promise.all([committing, savingSecond, savingThird])
    expect(saving.value).toBe(false)
  })

  it('updates a newly created record rather than creating it again', async () => {
    const backend = deferredBackend()
    const { draft, commit } = editor(record(null), backend.save)
    const creating = commit()
    draft.value.name = 'later'
    const repeated = commit()
    await backend.settle('created')
    expect(backend.inputs()[1]).toEqual({ ...record('created'), name: 'later' })
    await backend.settle('created')
    expect(await creating).toBe('created')
    expect(await repeated).toBe('created')
    expect(backend.save).toHaveBeenCalledTimes(2)
  })

  it('does not repeat identical concurrent creation requests', async () => {
    const backend = deferredBackend()
    const { commit } = editor(record(null), backend.save)
    const creating = commit()
    const repeated = commit()
    await backend.settle('created')
    expect(await creating).toBe('created')
    expect(await repeated).toBe('created')
    expect(backend.save).toHaveBeenCalledTimes(1)
  })

  it('drains creation edits before returning the id for a fresh editor', async () => {
    const backend = deferredBackend()
    const { draft, commit } = editor(record(null), backend.save)
    const finished = vi.fn()
    const creating = commit().then((id) => {
      finished(id)
      return id
    })
    draft.value.name = 'later'
    draft.value.password = { action: 'set', value: 'later secret' }
    await backend.settle('created')
    expect(finished).not.toHaveBeenCalled()
    expect(backend.inputs()[1]).toEqual({
      id: 'created',
      name: 'later',
      password: { action: 'set', value: 'later secret' },
    })
    await backend.settle('created')
    expect(await creating).toBe('created')
  })
})
