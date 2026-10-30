import { describe, expect, it } from 'vitest'
import type { Identity } from '@/ipc/types'
import { hint, sourceName } from './source'

const admin: Identity = { id: 'i1', label: 'Admin', username: 'admin', keyId: null }
const data = { identities: [admin] }

describe('hint', () => {
  it('names where the value comes from', () => {
    expect(hint(data, { value: 22, from: { kind: 'default' } })).toBe('22 (par défaut)')
    expect(hint(data, { value: 'admin', from: { kind: 'identity', id: 'i1' } })).toBe(
      'admin (identité Admin)',
    )
    expect(hint(data, null, 'Aucun')).toBe('Aucun')
  })

  it('says when the source is gone', () => {
    expect(sourceName(data, { kind: 'identity', id: 'nope' })).toBe('identité supprimée')
  })
})
