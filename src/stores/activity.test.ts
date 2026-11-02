import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { ECHO_MS, LONG_MS, QUIET_MS, useActivity, workingTitle } from './activity'

beforeEach(() => {
  vi.useFakeTimers()
  setActivePinia(createPinia())
})
afterEach(() => vi.useRealTimers())

describe('tab activity', () => {
  it('is idle until a program prints on its own', () => {
    const activity = useActivity()
    expect(activity.of('a')).toBe('idle')
    activity.output('a')
    expect(activity.of('a')).toBe('working')
    vi.advanceTimersByTime(QUIET_MS)
    expect(activity.of('a')).toBe('idle')
  })

  it('ignores the echo of typing and resizing', () => {
    const activity = useActivity()
    activity.input('a')
    vi.advanceTimersByTime(ECHO_MS - 1)
    activity.output('a')
    expect(activity.of('a')).toBe('idle')
  })

  it('asks for attention when a long run ends out of sight, until the tab is seen', () => {
    const activity = useActivity()
    activity.view('other')
    for (let at = 0; at <= LONG_MS; at += 500) {
      activity.output('a')
      vi.advanceTimersByTime(500)
    }
    vi.advanceTimersByTime(QUIET_MS)
    expect(activity.of('a')).toBe('waiting')
    activity.view('a')
    expect(activity.of('a')).toBe('idle')
  })

  it('stays idle after a short run, or a long one the user watched', () => {
    const activity = useActivity()
    activity.output('short')
    vi.advanceTimersByTime(QUIET_MS)
    expect(activity.of('short')).toBe('idle')
    activity.view('watched')
    for (let at = 0; at <= LONG_MS; at += 500) {
      activity.output('watched')
      vi.advanceTimersByTime(500)
    }
    vi.advanceTimersByTime(QUIET_MS)
    expect(activity.of('watched')).toBe('idle')
  })

  it('marks a bell from a background tab only', () => {
    const activity = useActivity()
    activity.view('a')
    activity.bell('a')
    activity.bell('b')
    expect(activity.of('a')).toBe('idle')
    expect(activity.of('b')).toBe('waiting')
    activity.release('b')
    expect(activity.of('b')).toBe('idle')
  })

  it('reads braille spinners in a title as work', () => {
    expect(workingTitle('⠋ Claude Code')).toBe(true)
    expect(workingTitle('✳ Claude Code')).toBe(false)
    expect(workingTitle(null)).toBe(false)
  })
})
