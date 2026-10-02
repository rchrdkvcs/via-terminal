import { describe, expect, it } from 'vitest'
import { step } from './navigation'

const ids = ['a', 'b', 'c']

describe('step', () => {
  it.each([
    [null, 'ArrowDown', 'a'],
    [null, 'ArrowUp', 'c'],
    ['a', 'ArrowDown', 'b'],
    ['c', 'ArrowDown', 'c'],
    ['a', 'ArrowUp', 'a'],
    ['b', 'Home', 'a'],
    ['a', 'End', 'c'],
    ['gone', 'ArrowDown', 'a'],
    ['a', 'Enter', null],
  ])('from %j, %s lands on %j', (current, key, expected) => {
    expect(step(ids, current, key)).toBe(expected)
  })

  it('stays put in an empty list', () => {
    expect(step([], null, 'ArrowDown')).toBeNull()
  })
})
