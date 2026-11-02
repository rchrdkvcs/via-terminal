import { describe, expect, it } from 'vitest'
import { collapse, crumbs } from './breadcrumb'

describe('breadcrumb', () => {
  it('lists every directory from the root', () => {
    expect(crumbs('/srv/releases/current/')).toEqual([
      { label: '/', path: '/' },
      { label: 'srv', path: '/srv' },
      { label: 'releases', path: '/srv/releases' },
      { label: 'current', path: '/srv/releases/current' },
    ])
    expect(crumbs('/')).toEqual([{ label: '/', path: '/' }])
    expect(crumbs('.')).toEqual([{ label: '.', path: '.' }])
  })

  it('hides the middle of a deep path', () => {
    const deep = crumbs('/a/b/c/d/e')
    expect(collapse(deep).map((crumb) => crumb?.label ?? null)).toEqual(['/', null, 'd', 'e'])
    expect(collapse(crumbs('/a/b/c'))).toHaveLength(4)
  })
})
