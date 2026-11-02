import type { RemoteEntry } from '@/ipc/files'

export interface Crumb {
  label: string
  path: string
}

/** The directories leading to `directory`, root first; a relative path is one crumb. */
export function crumbs(directory: string): Crumb[] {
  if (!directory.startsWith('/')) return [{ label: directory || '.', path: directory || '.' }]
  const names = directory.split('/').filter(Boolean)
  return [
    { label: '/', path: '/' },
    ...names.map((name, index) => ({
      label: name,
      path: `/${names.slice(0, index + 1).join('/')}`,
    })),
  ]
}

/** Keeps the root and the last `tail` crumbs; the hidden middle comes back as one group. */
export function collapse(list: Crumb[], tail = 2): (Crumb | Crumb[])[] {
  return list.length <= tail + 2 ? list : [list[0], list.slice(1, -tail), ...list.slice(-tail)]
}

/** The subdirectories of a listing, symbolic links to directories included, in listing order. */
export function subdirectories(entries: readonly RemoteEntry[]): Crumb[] {
  return entries
    .filter((entry) => entry.kind === 'directory' || entry.targetKind === 'directory')
    .map((entry) => ({ label: entry.name, path: entry.path }))
}
