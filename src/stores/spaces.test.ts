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
})
