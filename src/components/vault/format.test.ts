import { describe, expect, it } from 'vitest'
import { addTags, parsePort, relativeTime, truncateMiddle } from './format'

describe('truncateMiddle', () => {
  it('keeps short text', () => {
    expect(truncateMiddle('SHA256:abc')).toBe('SHA256:abc')
  })

  it('keeps both ends of long text', () => {
    const result = truncateMiddle('SHA256:abcdefghijklmnopqrstuvwxyz0123456789', 21)
    expect(result).toBe('SHA256:abc…0123456789')
    expect(result).toHaveLength(21)
  })
})

describe('relativeTime', () => {
  const now = 1_700_000_000_000

  it('reads recent times', () => {
    expect(relativeTime(now - 10_000, now)).toBe('à l’instant')
    expect(relativeTime(now - 5 * 60_000, now)).toBe('il y a 5 minutes')
    expect(relativeTime(now - 24 * 3_600_000, now)).toBe('hier')
  })
})

describe('addTags', () => {
  it('splits on commas and skips duplicates', () => {
    expect(addTags(['prod'], ' web, Prod ,, db ')).toEqual(['prod', 'web', 'db'])
  })
})

describe('parsePort', () => {
  it.each([
    ['', null],
    [' 2222 ', 2222],
    ['0', undefined],
    ['70000', undefined],
    ['22a', undefined],
    ['2e3', undefined],
  ])('reads %j', (text, expected) => {
    expect(parsePort(text)).toBe(expected)
  })
})
