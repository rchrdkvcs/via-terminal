import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setup } from '@/stores/workbench.fixture'
import { api } from '@/ipc/client'
import type { Host, Mutation, VaultView } from '@/ipc/types'
import { notify } from '@/lib/notify'
import { useUi } from '@/stores/ui'
import { useVault } from '@/stores/vault'
import { useVaultActions } from './useVaultActions'

const host = (id: string, label: string): Host => ({
  id,
  label,
  address: `${id}.example`,
  port: null,
  credential: { kind: 'password', username: null },
  tags: [],
  notes: '',
  createdAt: 0,
  lastConnectedAt: null,
})

/** A native vault answering every write with its new view, or failing with `fail`. */
function backend() {
  let state: VaultView = {
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
    duplicateHost: vi.fn((id: string) =>
      reply('copy', (view) => ({
        ...view,
        hosts: [...view.hosts, { ...view.hosts.find((item) => item.id === id)!, id: 'copy' }],
      }))(),
    ),
    deleteHost: vi.fn((id: string) =>
      reply(null, (view) => ({ ...view, hosts: view.hosts.filter((item) => item.id !== id) }))(),
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

  it('tells why a deletion failed and keeps the selection', async () => {
    const ui = useUi()
    ui.vaultFocus = { section: 'hosts', id: 'alpha' }
    native.fail('verrouillé')
    useVaultActions().deleteHost('alpha')
    confirm()
    await vi.waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining('verrouillé')),
    )
    expect(useVault().host('alpha')).toBeDefined()
    expect(ui.vaultFocus).toEqual({ section: 'hosts', id: 'alpha' })
  })

  it('opens a host in the workbench', () => {
    const ui = useUi()
    ui.route = 'vault'
    useVaultActions().connect('alpha')
    expect(ui.route).toBe('workbench')
  })
})
