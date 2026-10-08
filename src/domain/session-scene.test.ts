import { describe, expect, it } from 'vitest'
import { sceneTone, sessionScene } from './session-scene'

describe('session scenes', () => {
  it('shows live and ended states as they are', () => {
    expect(sessionScene('verifying', null)).toBe('verifying')
    expect(sessionScene('disconnected', null)).toBe('disconnected')
    expect(sessionScene('asleep', null)).toBe('asleep')
  })

  it('tells failures apart by their reason', () => {
    expect(sessionScene('failed', 'unreachable')).toBe('unreachable')
    expect(sessionScene('failed', 'authentication')).toBe('refused')
    expect(sessionScene('failed', 'hostKey')).toBe('hostKey')
    expect(sessionScene('failed', 'cancelled')).toBe('exited')
  })

  it('treats a failure without a reason as a generic failure', () => {
    expect(sessionScene('failed', null)).toBe('failed')
    expect(sessionScene('failed', 'other')).toBe('failed')
  })

  it('warns when a retry can work and alarms when the user must act', () => {
    expect(sceneTone('unreachable')).toBe('warning')
    expect(sceneTone('disconnected')).toBe('warning')
    expect(sceneTone('refused')).toBe('danger')
    expect(sceneTone('hostKey')).toBe('danger')
    expect(sceneTone('failed')).toBe('danger')
    expect(sceneTone('connecting')).toBe('neutral')
    expect(sceneTone('exited')).toBe('neutral')
  })
})
