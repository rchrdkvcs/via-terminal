import { mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import HostCredentials from './HostCredentials.vue'
import { hostInput } from './inputs'

vi.mock('@/stores/vault', () => ({
  useVault: () => ({
    view: {
      groups: [],
      identities: [{ id: 'identity', label: 'Production', username: 'deploy', keyId: 'key' }],
      keys: [{ id: 'key', label: 'SSH' }],
      secretsAvailable: true,
    },
    hasPassword: () => true,
  }),
}))

it('selects one identity and removes credentials that would override it', async () => {
  const draft = hostInput(undefined)
  draft.overrides.username = 'old-user'
  draft.keyId = 'old-key'
  draft.password = { action: 'set', value: 'old-password' }
  const view = mount(HostCredentials, {
    props: {
      modelValue: draft,
      resolved: {
        username: null,
        port: { value: 22, from: { kind: 'default' } },
        identityId: null,
      },
    },
  })
  view
    .findComponent({ name: 'CredentialSelect' })
    .vm.$emit('update:modelValue', 'identity:identity')
  await view.vm.$nextTick()
  expect(draft.overrides).toMatchObject({ identityId: 'identity', username: null })
  expect(draft.keyId).toBeNull()
  expect(draft.password).toEqual({ action: 'clear' })
  expect(view.findAll('[role="combobox"]')).toHaveLength(1)
  expect(view.find('input').exists()).toBe(false)
  expect(view.emitted('commit')).toHaveLength(1)
})
