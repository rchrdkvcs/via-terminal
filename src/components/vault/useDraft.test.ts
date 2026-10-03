import { describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import type { SecretUpdate } from '@/ipc/types'
import { useDraft } from './useDraft'

interface Record {
  id: string | null
  name: string
  password: SecretUpdate
}

function setup(initial: Record, save = vi.fn(async (input: Record) => input.id ?? 'new')) {
  const stored = ref(initial)
  const validate = (input: Record) => (input.name ? null : 'Ajoutez un nom.')
  return {
    stored,
    save,
    ...useDraft({ kind: 'host', source: () => ({ ...stored.value }), save, validate }),
  }
}

describe('useDraft', () => {
  it('autosaves existing records only when they changed', async () => {
    const { draft, save, autosave } = setup({ id: 'a', name: 'one', password: { action: 'keep' } })
    await autosave()
    expect(save).not.toHaveBeenCalled()
    draft.value.name = 'two'
    await autosave()
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ name: 'two' }))
  })

  it('never autosaves a new record', async () => {
    const { draft, save, autosave, commit } = setup({
      id: null,
      name: '',
      password: { action: 'keep' },
    })
    draft.value.name = 'typed'
    await autosave()
    expect(save).not.toHaveBeenCalled()
    expect(await commit()).toBe('new')
  })

  it('keeps the input and explains a failure', async () => {
    const save = vi.fn(async () => Promise.reject({ code: 'invalid', message: 'Adresse invalide' }))
    const { draft, error, commit } = setup(
      { id: 'a', name: 'one', password: { action: 'keep' } },
      save,
    )
    draft.value.name = 'bad'
    expect(await commit()).toBeNull()
    expect(error.value).toBe('Adresse invalide.')
    expect(draft.value.name).toBe('bad')
  })

  it('validates before saving', async () => {
    const { draft, error, save, commit } = setup({
      id: 'a',
      name: 'one',
      password: { action: 'keep' },
    })
    draft.value.name = ''
    await commit()
    expect(save).not.toHaveBeenCalled()
    expect(error.value).toBe('Ajoutez un nom.')
  })

  it('sends a password once', async () => {
    const { draft, commit } = setup({ id: 'a', name: 'one', password: { action: 'keep' } })
    draft.value.password = { action: 'set', value: 'secret' }
    await commit()
    expect(draft.value.password).toEqual({ action: 'keep' })
  })

  it('ignores a creation response after the editor is disposed', async () => {
    let finish!: (id: string) => void
    const save = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve
        }),
    )
    const scope = effectScope()
    const editor = scope.run(() =>
      setup({ id: null, name: 'new', password: { action: 'keep' } }, save),
    )!
    const creating = editor.commit()
    await Promise.resolve()
    scope.stop()
    finish('created')
    expect(await creating).toBeNull()
    expect(editor.draft.value.id).toBeNull()
  })

  it('follows outside changes unless the user is editing', async () => {
    const { stored, draft } = setup({ id: 'a', name: 'one', password: { action: 'keep' } })
    stored.value = { ...stored.value, name: 'renamed' }
    await nextTick()
    expect(draft.value.name).toBe('renamed')
    draft.value.name = 'mine'
    stored.value = { ...stored.value, name: 'again' }
    await nextTick()
    expect(draft.value.name).toBe('mine')
    stored.value = { id: 'b', name: 'other', password: { action: 'keep' } }
    await nextTick()
    expect(draft.value.name).toBe('other')
  })
})
