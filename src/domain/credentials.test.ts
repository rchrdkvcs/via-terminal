import { describe, expect, it } from 'vitest'
import type { Effective, HostCredential, Identity } from '@/ipc/types'
import fixture from '@/test/fixtures/credential-cases.json'
import {
  choose,
  credentialOption,
  effective,
  optionId,
  parseOption,
  withUsername,
} from './credentials'

interface Case {
  name: string
  host: { port: number | null; credential: HostCredential }
  effective: Effective
}

const { identities, cases } = fixture as unknown as {
  identities: Identity[]
  cases: Case[]
}

describe('effective', () => {
  it.each(cases.map((entry) => [entry.name, entry] as const))('%s', (_, entry) => {
    expect(effective({ identities }, entry.host)).toEqual(entry.effective)
  })
})

describe('credential options', () => {
  it('round-trips option ids', () => {
    for (const option of [{ kind: 'identity', id: 'i' }, { kind: 'key', id: 'k' }, null] as const) {
      expect(parseOption(optionId(option))).toEqual(option)
    }
  })

  it('shows a password credential as the password form', () => {
    expect(credentialOption({ kind: 'password', username: 'root' })).toBeNull()
    expect(credentialOption({ kind: 'key', id: 'k', username: null })).toEqual({
      kind: 'key',
      id: 'k',
    })
  })

  it('keeps the username in effect when choosing a key or a password', () => {
    expect(choose({ kind: 'key', id: 'k' }, 'deploy')).toEqual({
      kind: 'key',
      id: 'k',
      username: 'deploy',
    })
    expect(choose(null, 'deploy')).toEqual({ kind: 'password', username: 'deploy' })
    expect(choose({ kind: 'identity', id: 'i' }, 'deploy')).toEqual({ kind: 'identity', id: 'i' })
  })

  it('sets the username of a key or password but never of an identity', () => {
    expect(withUsername({ kind: 'password', username: null }, 'root')).toEqual({
      kind: 'password',
      username: 'root',
    })
    expect(withUsername({ kind: 'identity', id: 'i' }, 'root')).toEqual({
      kind: 'identity',
      id: 'i',
    })
  })
})
