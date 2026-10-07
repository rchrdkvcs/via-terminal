import { describe, expect, it } from 'vitest'
import type { Host } from '@/ipc/types'
import { matches } from './search'

const host: Host = {
  id: 'h1',
  groupId: 'g1',
  label: 'Base de données',
  address: 'db.example.net',
  port: null,
  credential: { kind: 'inherit' },
  tags: ['postgres', 'prod'],
  notes: 'not searched',
  createdAt: 0,
  lastConnectedAt: null,
}
const item = { host, username: 'admin', groupPath: ['Clients', 'Acme'] }

describe('matches', () => {
  it.each(['', 'db', 'EXAMPLE', 'donnees', 'admin', 'postgres', 'acme', 'prod db'])(
    'finds %j',
    (query) => {
      expect(matches(item, query)).toBe(true)
    },
  )

  it.each(['staging', 'searched', 'db staging'])('rejects %j', (query) => {
    expect(matches(item, query)).toBe(false)
  })
})
