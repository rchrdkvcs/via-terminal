import { describe, expect, it } from 'vitest'
import type { Effective, Group, HostCredential, Id, Identity } from '@/ipc/types'
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
  host: { groupId: Id | null; port: number | null; credential: HostCredential }
  effective: Effective
}

const { groups, identities, cases } = fixture as unknown as {
  groups: Group[]
  identities: Identity[]
  cases: Case[]
}

const inherit: HostCredential = { kind: 'inherit', username: null, key: null }

describe('effective', () => {
  it.each(cases.map((entry) => [entry.name, entry] as const))('%s', (_, entry) => {
    expect(effective({ groups, identities }, entry.host)).toEqual(entry.effective)
  })
})

describe('credential options', () => {
  it('round-trips option ids', () => {
    for (const option of [
      { kind: 'inherit' },
      { kind: 'identity', id: 'i' },
      { kind: 'key', id: 'k' },
      null,
    ] as const) {
      expect(parseOption(optionId(option))).toEqual(option)
    }
  })

  it('shows an inherited credential as the password form when nothing is inherited', () => {
    expect(credentialOption(inherit, true)).toEqual({ kind: 'inherit' })
    expect(credentialOption(inherit, false)).toBeNull()
    expect(credentialOption({ kind: 'password', username: 'root' }, true)).toBeNull()
  })

  it('shows an older inherited key override as that key', () => {
    expect(credentialOption({ ...inherit, key: 'k' }, true)).toEqual({ kind: 'key', id: 'k' })
  })

  it('keeps the username in effect when choosing a key or a password', () => {
    expect(choose({ kind: 'key', id: 'k' }, 'deploy')).toEqual({
      kind: 'key',
      id: 'k',
      username: 'deploy',
    })
    expect(choose(null, 'deploy')).toEqual({ kind: 'password', username: 'deploy' })
    expect(choose({ kind: 'identity', id: 'i' }, 'deploy')).toEqual({ kind: 'identity', id: 'i' })
    expect(choose({ kind: 'inherit' }, 'deploy')).toEqual(inherit)
  })

  it('makes an inherited credential explicit once a username is typed', () => {
    expect(withUsername(inherit, 'root')).toEqual({
      kind: 'password',
      username: 'root',
    })
    expect(withUsername({ ...inherit, username: 'old' }, 'root')).toEqual({
      ...inherit,
      username: 'root',
    })
    expect(withUsername({ kind: 'identity', id: 'i' }, 'root')).toEqual({
      kind: 'identity',
      id: 'i',
    })
  })
})
