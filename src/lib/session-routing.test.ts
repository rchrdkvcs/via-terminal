import { describe, expect, it } from 'vitest'
import { SessionRouting } from './session-routing'

describe('SessionRouting', () => {
  it('holds events that arrive before the session is bound', () => {
    const routing = new SessionRouting()
    const seen: string[] = []
    routing.route('s1', (tab) => seen.push(`early:${tab}`))
    routing.bind('s1', 't1')
    routing.route('s1', (tab) => seen.push(`late:${tab}`))
    expect(seen).toEqual(['early:t1', 'late:t1'])
  })

  it('drops events of finished sessions instead of queueing them', () => {
    const routing = new SessionRouting()
    const seen: string[] = []
    routing.bind('s1', 't1')
    routing.finish('s1')
    routing.route('s1', () => seen.push('x'))
    routing.bind('s1', 't2')
    expect(seen).toEqual([])
    expect(routing.tabOf('s1')).toBe('t2')
  })
})
