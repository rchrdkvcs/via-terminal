import { describe, expect, it } from 'vitest'
import { rank, scoreText } from './search'

describe('command bar ranking', () => {
  it('prefers prefixes, then substrings, then scattered letters', () => {
    expect(scoreText('prod', 'prod-web')).toBeGreaterThan(scoreText('prod', 'old-prod'))
    expect(scoreText('prod', 'old-prod')).toBeGreaterThan(scoreText('pw', 'prod-web'))
    expect(scoreText('xyz', 'prod-web')).toBe(0)
  })

  it('ignores case and accents', () => {
    expect(scoreText('ecole', 'École-01')).toBeGreaterThan(0)
  })

  it('ranks across fields and drops non-matches', () => {
    const hosts = [
      { label: 'app-www', address: '10.0.0.2' },
      { label: 'prod-web', address: '10.0.0.1' },
      { label: 'db', address: 'db.lan' },
    ]
    const result = rank('pw', hosts, (host) => [host.label, host.address])
    expect(result.map((host) => host.label)).toEqual(['prod-web', 'app-www'])
    expect(rank('10.0.0.1', hosts, (host) => [host.label, host.address])[0].label).toBe('prod-web')
  })
})
