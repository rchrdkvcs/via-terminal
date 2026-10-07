import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import PromptSecret from './PromptSecret.vue'

vi.mock('@/stores/vault', () => ({
  useVault: () => ({
    view: {
      identities: [{ id: 'identity', label: 'Production', username: 'deploy', keyId: 'key' }],
      keys: [{ id: 'key', label: 'Clé production' }],
    },
  }),
}))

it('offers vault credentials when connecting instead of only a password', () => {
  const view = mount(PromptSecret, {
    props: {
      prompt: {
        kind: 'password',
        username: 'root',
        address: 'example.test',
        canRemember: true,
        retry: false,
      },
    },
  })
  expect(view.find('[role="combobox"]').exists()).toBe(true)
})

it('submits a vault key with its username and hides the password field', async () => {
  const view = mount(PromptSecret, {
    props: {
      prompt: {
        kind: 'authentication',
        username: null,
        address: 'example.test',
        canRemember: true,
      },
    },
  })
  const select = view.findComponent({ name: 'CredentialSelect' })
  select.vm.$emit('update:modelValue', 'key:key')
  await view.vm.$nextTick()
  expect(view.find('input[type="password"]').exists()).toBe(false)
  await view.find('input[aria-label="Nom d’utilisateur"]').setValue('deploy')
  await view.find('form').trigger('submit')
  expect(view.emitted('answer')).toEqual([
    [
      {
        kind: 'credential',
        credential: { kind: 'key', id: 'key', username: 'deploy' },
      },
    ],
  ])
})

it('uses the saved identity without sending a competing username or password', async () => {
  const view = mount(PromptSecret, {
    props: {
      prompt: {
        kind: 'password',
        username: 'root',
        address: 'example.test',
        canRemember: true,
        retry: true,
      },
    },
  })
  view
    .findComponent({ name: 'CredentialSelect' })
    .vm.$emit('update:modelValue', 'identity:identity')
  await view.vm.$nextTick()
  expect(view.find('input').exists()).toBe(false)
  await view.find('form').trigger('submit')
  expect(view.emitted('answer')).toEqual([
    [{ kind: 'credential', credential: { kind: 'identity', id: 'identity' } }],
  ])
})

it('submits username and password together for a new connection', async () => {
  const view = mount(PromptSecret, {
    props: {
      prompt: {
        kind: 'authentication',
        username: null,
        address: 'example.test',
        canRemember: true,
      },
    },
  })
  await view.find('input[aria-label="Nom d’utilisateur"]').setValue('deploy')
  await view.find('input[type="password"]').setValue('fixture-password')
  await view.find('form').trigger('submit')
  expect(view.emitted('answer')).toEqual([
    [{ kind: 'authentication', username: 'deploy', password: 'fixture-password', remember: false }],
  ])
})

it('keeps passphrase prompts specific to the selected key', () => {
  const view = mount(PromptSecret, {
    props: {
      prompt: {
        kind: 'passphrase',
        keyLabel: 'Clé production',
        canRemember: true,
        retry: false,
      },
    },
  })
  expect(view.find('[role="combobox"]').exists()).toBe(false)
  expect(view.find('input[type="password"]').exists()).toBe(true)
})
