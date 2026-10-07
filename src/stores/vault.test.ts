import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/ipc/client'
import type { Group, GroupInput, Host, HostInput, Mutation, VaultView } from '@/ipc/types'
import { useDraft } from '@/components/vault/useDraft'
import { flush } from '@/test/vaultSaves'
import { useVault } from './vault'
import { groupInput, hostInput } from './vault-inputs'

const defaults = { username: null, port: null, identityId: null }

function host(id: string, label: string): Host {
  const base = {
    groupId: null,
    port: null,
    credential: { kind: 'inherit', username: null, key: null } as const,
  }
  const extra = { tags: [], notes: '' }
  return {
    ...base,
    ...extra,
    id,
    label,
    address: `${id}.example`,
    createdAt: 0,
    lastConnectedAt: null,
  }
}

function group(id: string, name: string): Group {
  return { id, parentId: null, name, position: 0, defaults: { ...defaults } }
}

/** Applies each write when its reply is released, like the native vault. */
function backend() {
  let state: VaultView = {
    groups: [group('g', 'Servers')],
    hosts: [host('a', 'Alpha'), host('b', 'Beta')],
    identities: [],
    keys: [],
    knownHosts: [],
    passwords: [],
    passphrases: [],
    secretsAvailable: true,
    effective: {},
    revision: 0,
  }
  const replies: Array<{ commit: () => Mutation; resolve: (reply: Mutation) => void }> = []
  const commit = (change: (view: VaultView) => VaultView, id: string | null) => () => {
    state = { ...change(state), revision: state.revision + 1 }
    return { id, vault: state }
  }
  const held = (commit: () => Mutation) =>
    new Promise<Mutation>((resolve) => replies.push({ commit, resolve }))

  const saveHost = vi.spyOn(api.vault, 'saveHost').mockImplementation((input: HostInput) =>
    held(
      commit((view) => {
        const { password: _, ...fields } = input
        const hosts = view.hosts.map((item) =>
          item.id === input.id ? { ...item, ...fields, id: item.id } : item,
        )
        return { ...view, hosts }
      }, input.id),
    ),
  )
  const saveGroup = vi.spyOn(api.vault, 'saveGroup').mockImplementation((input: GroupInput) =>
    held(
      commit((view) => {
        const groups = view.groups.map((item) =>
          item.id === input.id ? { ...item, ...input, id: item.id } : item,
        )
        return { ...view, groups }
      }, input.id),
    ),
  )
  const deleteHost = vi
    .spyOn(api.vault, 'deleteHost')
    .mockImplementation((id) =>
      held(
        commit((view) => ({ ...view, hosts: view.hosts.filter((item) => item.id !== id) }), null),
      ),
    )

  async function release() {
    const reply = replies.shift()!
    reply.resolve(reply.commit())
    await flush()
  }
  return { state: () => state, replies, release, saveHost, saveGroup, deleteHost }
}

let server: ReturnType<typeof backend>

beforeEach(() => {
  vi.restoreAllMocks()
  setActivePinia(createPinia())
  server = backend()
  useVault().hydrate(server.state())
})

describe('vault writes', () => {
  it('queues a host rename behind an editor save and keeps both changes', async () => {
    const vault = useVault()
    const editor = useDraft({ kind: 'host', source: () => hostInput(vault.host('a')) })
    editor.draft.value.notes = 'first'
    const saving = editor.autosave()
    const renaming = vault.rename('a', 'Renamed')
    editor.draft.value.notes = 'second'
    const later = editor.autosave()

    await server.release()
    await saving
    expect(server.saveHost.mock.calls[1]![0]).toMatchObject({ label: 'Renamed', notes: 'first' })
    await server.release()
    await renaming
    await server.release()
    await later
    expect(server.saveHost.mock.calls[2]![0]).toMatchObject({ label: 'Renamed', notes: 'second' })
    expect(vault.host('a')).toMatchObject({ label: 'Renamed', notes: 'second' })
    expect(editor.draft.value).toMatchObject({ label: 'Renamed', notes: 'second' })
    await editor.autosave()
    expect(server.saveHost).toHaveBeenCalledTimes(3)
  })

  it('keeps a group rename when its editor saves unsaved changes afterwards', async () => {
    const vault = useVault()
    const editor = useDraft({ kind: 'group', source: () => groupInput(vault.group('g')) })
    editor.draft.value.defaults.port = 2222
    const renaming = vault.renameGroup('g', 'Production')
    await server.release()
    await renaming
    expect(editor.draft.value).toMatchObject({ name: 'Production', defaults: { port: 2222 } })

    const saving = editor.autosave()
    await server.release()
    await saving
    expect(vault.group('g')).toMatchObject({ name: 'Production', defaults: { port: 2222 } })
  })

  it('drops waiting saves of a deleted record and deletes after the one already sent', async () => {
    const vault = useVault()
    const editor = useDraft({ kind: 'host', source: () => hostInput(vault.host('a')) })
    editor.draft.value.notes = 'sent'
    void editor.autosave()
    editor.draft.value.notes = 'waiting'
    void editor.autosave()
    const removing = vault.remove('host', 'a')
    await flush()
    expect(server.deleteHost).not.toHaveBeenCalled()

    await server.release()
    expect(server.deleteHost).toHaveBeenCalledWith('a')
    await server.release()
    await removing
    await vault.flush()
    expect(server.saveHost).toHaveBeenCalledTimes(1)
    expect(vault.host('a')).toBeUndefined()
  })

  it('never lets an older reply replace a newer view', async () => {
    const vault = useVault()
    const first = vault.rename('a', 'One')
    const second = vault.rename('b', 'Two')
    await flush()
    const [older, newer] = server.replies.splice(0, 2)
    const olderReply = older!.commit()
    newer!.resolve(newer!.commit())
    await flush()
    older!.resolve(olderReply)
    await Promise.all([first, second])
    expect(vault.view.revision).toBe(2)
    expect(vault.host('a')?.label).toBe('One')
    expect(vault.host('b')?.label).toBe('Two')
  })
})
