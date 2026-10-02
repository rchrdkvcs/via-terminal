import { describe, expect, it } from 'vitest'
import type { Group, Identity } from '@/ipc/types'
import { hint, identityHint, inherited, sourceName } from './inherit'

const admin: Identity = { id: 'i1', label: 'Admin', username: 'admin', keyId: null }
const root: Group = {
  id: 'g1',
  parentId: null,
  name: 'Prod',
  position: 0,
  defaults: { username: null, port: 2222, identityId: 'i1' },
}
const child: Group = {
  id: 'g2',
  parentId: 'g1',
  name: 'Web',
  position: 0,
  defaults: { username: 'deploy', port: null, identityId: null },
}
const data = { groups: [root, child], identities: [admin] }

describe('inherited', () => {
  it('falls back to port 22 with no group', () => {
    expect(inherited(data, null)).toEqual({
      username: null,
      port: { value: 22, from: { kind: 'default' } },
      identityId: null,
    })
  })

  it('takes the nearest group for each field', () => {
    const result = inherited(data, 'g2')
    expect(result.username).toEqual({ value: 'deploy', from: { kind: 'group', id: 'g2' } })
    expect(result.port).toEqual({ value: 2222, from: { kind: 'group', id: 'g1' } })
    expect(result.identityId).toEqual({ value: 'i1', from: { kind: 'group', id: 'g1' } })
  })

  it('reads the username of a group identity', () => {
    expect(inherited(data, 'g1').username).toEqual({
      value: 'admin',
      from: { kind: 'identity', id: 'i1' },
    })
  })

  it('prefers the item own identity for the username', () => {
    const ops = { ...admin, id: 'i2', label: 'Ops', username: 'ops' }
    expect(inherited({ ...data, identities: [admin, ops] }, 'g2', 'i2').username?.value).toBe('ops')
  })

  it('survives a cycle in bad data', () => {
    const loop = { ...root, parentId: 'g2' }
    expect(inherited({ groups: [loop, child], identities: [] }, 'g2').port.value).toBe(2222)
  })
})

describe('hint', () => {
  it('names where the value comes from', () => {
    expect(hint(data, { value: 22, from: { kind: 'default' } })).toBe('22 (par défaut)')
    expect(hint(data, { value: 2222, from: { kind: 'group', id: 'g1' } })).toBe(
      '2222 (groupe Prod)',
    )
    expect(hint(data, null, 'Aucun')).toBe('Aucun')
  })

  it('describes an inherited identity', () => {
    expect(identityHint(data, { value: 'i1', from: { kind: 'group', id: 'g1' } })).toBe(
      'Héritée : Admin (groupe Prod)',
    )
    expect(identityHint(data, null)).toBe('Aucune')
  })

  it('says when the source is gone', () => {
    expect(sourceName(data, { kind: 'identity', id: 'nope' })).toBe('identité supprimée')
  })
})
