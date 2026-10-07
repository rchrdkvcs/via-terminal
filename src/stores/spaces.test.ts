import { describe, expect, it } from 'vitest'
import { setup } from './workbench.fixture'

describe('space switch direction', () => {
  it('follows the order of spaces when activating one', () => {
    const { spaces } = setup()
    spaces.activate('two')
    expect(spaces.switchDirection).toBe(1)
    spaces.activate('one')
    expect(spaces.switchDirection).toBe(-1)
  })

  it('keeps the cycling direction across the wrap-around', () => {
    const { spaces } = setup()
    spaces.cycle(-1)
    expect(spaces.activeId).toBe('two')
    expect(spaces.switchDirection).toBe(-1)
  })

  it('wraps forward from the last space, sliding in from the right', () => {
    const { spaces } = setup()
    spaces.activate('two')
    spaces.cycle(1)
    expect(spaces.activeId).toBe('one')
    expect(spaces.switchDirection).toBe(1)
  })

  it('stays put when there is no other space to swipe to', () => {
    const { spaces } = setup()
    spaces.remove('two')
    const before = spaces.activeId
    spaces.cycle(1)
    spaces.cycle(-1)
    expect(spaces.activeId).toBe(before)
  })
})
