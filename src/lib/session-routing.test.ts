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

  it('stops delivering queued events once one of them ends the session', () => {
    const routing = new SessionRouting()
    const seen: string[] = []
    routing.route('s1', () => {
      seen.push('exit')
      routing.finish('s1')
    })
    routing.route('s1', () => seen.push('output'))
    routing.bind('s1', 't1')
    expect(seen).toEqual(['exit'])
  })

  it('remembers only the most recently finished sessions', () => {
    const routing = new SessionRouting(2)
    const seen: string[] = []
    for (const id of ['s1', 's2', 's3']) routing.finish(id)
    routing.route('s3', () => seen.push('s3'))
    routing.route('s2', () => seen.push('s2'))
    routing.route('s1', () => seen.push('s1'))
    for (const id of ['s1', 's2', 's3']) routing.bind(id, 't1')
    expect(seen).toEqual(['s1'])
  })
})
