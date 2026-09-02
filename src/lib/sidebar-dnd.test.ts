import { afterEach, describe, expect, it } from 'vitest'
import { clearDropHint, dropHint, setDropHint } from './sidebar-dnd'

describe('sidebar drop hint ownership', () => {
  afterEach(() => clearDropHint())

  it('keeps exactly the latest nested drop target active', () => {
    setDropHint('folder:one', 'folder:one:into')
    setDropHint('tab:two', 'tab:two:right')

    expect(dropHint.value).toBe('tab:two:right')

    // A delayed leave from the previous, nested target must not erase the
    // destination that is currently under the pointer.
    clearDropHint('folder:one')
    expect(dropHint.value).toBe('tab:two:right')
  })

  it('clears the hint owned by the target being left', () => {
    setDropHint('folder:one', 'folder:one:into')
    clearDropHint('folder:one')

    expect(dropHint.value).toBeNull()
  })
})
