import { describe, expect, it } from 'vitest'
import { formatQuickTarget, parseQuickConnect } from './quick-connect'

describe('parseQuickConnect', () => {
  it.each([
    ['root@10.0.0.5', { address: '10.0.0.5', port: null, username: 'root' }],
    ['admin@srv.example.net:2222', { address: 'srv.example.net', port: 2222, username: 'admin' }],
    ['ssh -p 2200 deploy@web-1.lan', { address: 'web-1.lan', port: 2200, username: 'deploy' }],
    ['ssh -l bob host.local', { address: 'host.local', port: null, username: 'bob' }],
    ['[::1]:22', { address: '::1', port: 22, username: null }],
    ['192.168.1.20', { address: '192.168.1.20', port: null, username: null }],
  ])('reads %s', (input, expected) => {
    expect(parseQuickConnect(input)).toEqual(expected)
  })

  it.each(['prod', 'two words', 'root@', 'host:99999', 'a@-bad.host', ''])(
    'treats %s as a search, not an address',
    (input) => {
      expect(parseQuickConnect(input)).toBeNull()
    },
  )

  it('formats targets the way users type them', () => {
    expect(formatQuickTarget({ address: 'h.lan', port: 2222, username: 'u' })).toBe('u@h.lan:2222')
    expect(formatQuickTarget({ address: '::1', port: null, username: null })).toBe('[::1]')
  })
})
