import { describe, expect, it } from 'vitest'
import type { Row } from '@/ipc/types'
import { placeFor } from './drop'
import type { Space } from './space'

const tab = (id: string): Row => ({
  kind: 'tab',
  id,
  title: null,
  target: { kind: 'local', shell: null, cwd: null },
})
const space: Space = {
  id: 's',
  name: 'S',
  icon: 'terminal',
  defaultShell: null,
  pinned: [
    tab('p1'),
    { kind: 'folder', id: 'f', name: 'F', open: true, rows: [tab('f1'), tab('f2')] },
  ],
  temporary: [tab('t1'), tab('t2')],
}

describe('placeFor', () => {
  it('places before and after rows in their own list', () => {
    expect(placeFor(space, 't1', 'after')).toEqual({ area: 'temporary', before: 't2' })
    expect(placeFor(space, 't2', 'after')).toEqual({ area: 'temporary', before: null })
    expect(placeFor(space, 'f1', 'before')).toEqual({ area: 'pinned', folderId: 'f', before: 'f1' })
    expect(placeFor(space, 'p1', 'after')).toEqual({ area: 'pinned', folderId: null, before: 'f' })
  })

  it('drops into folders only', () => {
    expect(placeFor(space, 'f', 'into')).toEqual({ area: 'pinned', folderId: 'f', before: null })
    expect(placeFor(space, 'p1', 'into')).toBeNull()
  })
})
