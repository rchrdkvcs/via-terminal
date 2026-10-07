import { beforeEach, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useFileDialogs } from './file-dialogs'
beforeEach(() => setActivePinia(createPinia()))

it('keeps an invalid answer open with its message, then accepts a valid one', async () => {
  const dialogs = useFileDialogs()
  const asking = dialogs.ask({
    title: 'Permissions',
    description: '/config',
    input: '9',
    actions: [{ label: 'Appliquer', value: 'apply' }],
    validate: (value) => (/^[0-7]{3}$/.test(value) ? null : 'Trois chiffres octaux.'),
  })
  expect(dialogs.answer({ choice: 'apply', value: '9', all: false })).toBe(false)
  expect(dialogs.error).toBe('Trois chiffres octaux.')
  expect(dialogs.current?.title).toBe('Permissions')
  expect(dialogs.answer({ choice: 'apply', value: '644', all: false })).toBe(true)
  expect(await asking).toEqual({ choice: 'apply', value: '644', all: false })
  expect(dialogs.error).toBeNull()
})

it('treats dismissal and unoffered choices as cancel without validating', async () => {
  const dialogs = useFileDialogs()
  const asking = dialogs.ask({
    title: 'Nom',
    description: '/',
    actions: [{ label: 'Créer', value: 'create' }],
    validate: () => 'jamais valide',
  })
  dialogs.answer({ choice: 'forged', value: '', all: false })
  expect((await asking).choice).toBe('cancel')
})
