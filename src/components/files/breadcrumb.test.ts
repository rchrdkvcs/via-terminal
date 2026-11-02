import { describe, expect, it } from 'vitest'
import { collapse, crumbs, subdirectories } from './breadcrumb'
import type { RemoteEntry } from '@/ipc/files'

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
    expect(collapse(deep)).toEqual([
      { label: '/', path: '/' },
      [
        { label: 'a', path: '/a' },
        { label: 'b', path: '/a/b' },
        { label: 'c', path: '/a/b/c' },
      ],
      { label: 'd', path: '/a/b/c/d' },
      { label: 'e', path: '/a/b/c/d/e' },
    ])
    expect(collapse(crumbs('/a/b/c'))).toHaveLength(4)
  })

  it('keeps the folders of a listing, links to folders included', () => {
    const entry = (name: string, kind: string, targetKind: string | null = null) =>
      ({ name, path: `/etc/${name}`, kind, targetKind }) as RemoteEntry
    expect(
      subdirectories([
        entry('hosts', 'file'),
        entry('nginx', 'directory'),
        entry('ssl', 'link', 'directory'),
        entry('mtab', 'link', 'file'),
      ]),
    ).toEqual([
      { label: 'nginx', path: '/etc/nginx' },
      { label: 'ssl', path: '/etc/ssl' },
    ])
  })
})
