import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { setup } from '@/stores/workbench.fixture'
import { api } from '@/ipc/client'
import type { Group, GroupInput, Host, Mutation, VaultView } from '@/ipc/types'
import { notify } from '@/lib/notify'
import { useUi } from '@/stores/ui'
import { useVault } from '@/stores/vault'
import { useGroupTree } from './useGroupTree'
import { useVaultActions } from './useVaultActions'
import { provideVaultState, type VaultState } from './useVaultState'

const defaults = { username: null, port: null, identityId: null }
const group = (id: string, name: string, parentId: string | null = null): Group => ({
  id,
  parentId,
  name,
  position: 0,
  defaults: { ...defaults },
})
const host = (id: string, label: string): Host => ({
  id,
  label,
  address: `${id}.example`,
  groupId: null,
  port: null,
  credential: { kind: 'inherit', username: null, key: null },
  tags: [],
  notes: '',
  createdAt: 0,
  lastConnectedAt: null,
})

/** A native vault answering every write with its new view, or failing with `fail`. */
function backend() {
  let state: VaultView = {
    groups: [group('servers', 'Servers'), group('web', 'Web', 'servers')],
    hosts: [host('alpha', 'Alpha')],
    identities: [],
    keys: [],
    knownHosts: [],
    passwords: [],
    passphrases: [],
    secretsAvailable: true,
    effective: {},
    revision: 0,
  }
  let failure: Error | null = null
  const reply = (id: string | null, change: (view: VaultView) => VaultView) => async () => {
    if (failure) throw failure
    state = { ...change(state), revision: state.revision + 1 }
    return { id, vault: state } as Mutation
  }
  const vault = {
    saveGroup: vi.fn((input: GroupInput) => {
      const id = input.id ?? `group-${state.groups.length}`
      return reply(id, (view) => ({
        ...view,
        groups: [
          ...view.groups.filter((item) => item.id !== id),
          { ...group(id, input.name, input.parentId), ...input, id },
        ],
      }))()
    }),
    duplicateHost: vi.fn((id: string) =>
      reply('copy', (view) => ({
        ...view,
        hosts: [...view.hosts, { ...view.hosts.find((item) => item.id === id)!, id: 'copy' }],
      }))(),
    ),
    deleteHost: vi.fn((id: string) =>
      reply(null, (view) => ({ ...view, hosts: view.hosts.filter((item) => item.id !== id) }))(),
    ),
    deleteGroup: vi.fn((id: string) =>
      reply(null, (view) => ({ ...view, groups: view.groups.filter((item) => item.id !== id) }))(),
    ),
  }
  Object.assign(api, { vault })
  useVault().hydrate(state)
  return {
    vault,
    state: () => state,
    fail: (message: string) => (failure = new Error(message)),
  }
}

let native: ReturnType<typeof backend>
beforeEach(() => {
  setup()
  native = backend()
})

/** The user accepts the pending confirmation. */
function confirm() {
  const ui = useUi()
  const request = ui.confirmation!
  ui.confirmation = null
  request.run()
}

describe('vault actions', () => {
  it('duplicates a host and selects the copy', async () => {
    await useVaultActions().duplicateHost('alpha')
    expect(useVault().host('copy')?.label).toBe('Alpha')
    expect(useUi().vaultFocus).toEqual({ section: 'hosts', id: 'copy' })
  })

  it('tells why a duplicate failed and keeps the selection', async () => {
    useUi().vaultFocus = { section: 'hosts', id: 'alpha' }
    native.fail('disque plein')
    await useVaultActions().duplicateHost('alpha')
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('disque plein'))
    expect(useUi().vaultFocus).toEqual({ section: 'hosts', id: 'alpha' })
  })

  it('deletes a host once confirmed and forgets it as the selection', async () => {
    const ui = useUi()
    ui.vaultFocus = { section: 'hosts', id: 'alpha' }
    useVaultActions().deleteHost('alpha')
    expect(ui.confirmation?.title).toBe('Supprimer « Alpha » ?')
    expect(native.vault.deleteHost).not.toHaveBeenCalled()

    confirm()
    await vi.waitFor(() => expect(ui.vaultFocus.id).toBeNull())
    expect(useVault().host('alpha')).toBeUndefined()
  })

  it('tells why a deletion failed', async () => {
    native.fail('verrouillé')
    useVaultActions().deleteGroup('web')
    expect(useUi().confirmation?.description).toContain('dans « Servers »')
    confirm()
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('verrouillé')),
    )
    expect(useVault().group('web')).toBeDefined()
  })

  it('opens a host in the workbench', () => {
    const ui = useUi()
    ui.route = 'vault'
    useVaultActions().connect('alpha')
    expect(ui.route).toBe('workbench')
  })
})

function tree() {
  let state!: VaultState
  let actions!: ReturnType<typeof useGroupTree>
  const Tree = defineComponent({
    setup() {
      actions = useGroupTree()
      return () => null
    },
  })
  mount(
    defineComponent({
      setup() {
        state = provideVaultState()
        return () => h(Tree)
      },
    }),
  )
  return { state, actions }
}

describe('group tree', () => {
  it('adds a group inside its expanded parent, selects it and starts renaming', async () => {
    const { state, actions } = tree()
    actions.toggle('servers')
    expect(state.collapsed.has('servers')).toBe(true)

    await actions.add('servers')
    const created = native.state().groups[native.state().groups.length - 1]
    expect(created).toMatchObject({ parentId: 'servers', name: 'Nouveau groupe' })
    expect(state.collapsed.has('servers')).toBe(false)
    expect(state.scope.value).toBe(created.id)
    expect(state.selected.value).toBe(created.id)
    expect(state.renaming.value).toBe(created.id)
  })

  it('tells why a group could not be added and selects nothing', async () => {
    const { state, actions } = tree()
    native.fail('hors ligne')
    await actions.add(null)
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('hors ligne'))
    expect(state.selected.value).toBeNull()
    expect(state.renaming.value).toBeNull()
  })

  it('renames a group, and an empty name only ends the renaming', async () => {
    const { state, actions } = tree()
    state.renaming.value = 'web'
    await actions.rename('web', null)
    expect(state.renaming.value).toBeNull()
    expect(native.vault.saveGroup).not.toHaveBeenCalled()

    await actions.rename('web', 'Front')
    expect(useVault().group('web')?.name).toBe('Front')
  })

  it('tells why a rename failed', async () => {
    const { actions } = tree()
    native.fail('refusé')
    await actions.rename('web', 'Front')
    expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('refusé'))
    expect(useVault().group('web')?.name).toBe('Web')
  })
})
