import { describe, expect, it } from 'vitest'
import type { Host, VaultView } from '@/ipc/types'
import { accountsFor, otherAccount } from './accounts'

const host = (id: string, address: string, username: string | null, port = 22): Host => ({
  id,
  label: id,
  address,
  port: port === 22 ? null : port,
  credential: { kind: 'password', username },
  tags: [],
  notes: '',
  createdAt: 0,
  lastConnectedAt: null,
})
function vault(...hosts: Host[]): VaultView {
  return {
    effective: Object.fromEntries(
      hosts.map((entry) => [
        entry.id,
        {
          username:
            entry.credential.kind === 'password' && entry.credential.username
              ? { value: entry.credential.username, source: 'host' }
              : null,
          port: { value: entry.port ?? 22, source: 'host' },
          identityId: null,
          keyId: null,
        },
      ]),
    ) as unknown as VaultView['effective'],
    revision: 0,
    passwords: [],
    passphrases: [],
    secretsAvailable: true,
    hosts,
    identities: [],
    keys: [],
    knownHosts: [],
  }
}

describe('accounts on the same server', () => {
  const view = vault(
    host('deploy', 'web.example', 'deploy'),
    host('root', 'WEB.example', 'root'),
    host('root-copy', 'web.example', 'root'),
    host('other-port', 'web.example', 'admin', 2222),
    host('elsewhere', 'db.example', 'root'),
  )

  it('lists every username saved for the same address and port', () => {
    const accounts = accountsFor({ kind: 'host', hostId: 'deploy' }, view)
    expect(accounts.map((account) => [account.username, account.current])).toEqual([
      ['deploy', true],
      ['root', false],
    ])
  })

  it('keeps a typed target as the current account', () => {
    const target = { kind: 'quick', address: 'web.example', port: null, username: 'www' } as const
    expect(accountsFor(target, view).map((account) => account.username)).toEqual([
      'www',
      'deploy',
      'root',
    ])
  })

  it('builds a typed account on the same address and port', () => {
    expect(otherAccount({ kind: 'host', hostId: 'other-port' }, view, ' backup ')).toEqual({
      kind: 'quick',
      address: 'web.example',
      port: 2222,
      username: 'backup',
    })
    expect(otherAccount({ kind: 'host', hostId: 'deploy' }, view, 'a b')).toBeNull()
    expect(otherAccount({ kind: 'local', shell: null, cwd: null }, view, 'root')).toBeNull()
  })
})
