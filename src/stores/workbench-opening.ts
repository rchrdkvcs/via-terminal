import type { Id, Target } from '@/ipc/types'
import { newTabRow, rowOfTab } from '@/domain/space'
import type { Edge } from '@/domain/split'
import type { WorkbenchParts } from './workbench-parts'

export function createTabOpening({
  spaces,
  sessions,
  activate,
}: Pick<WorkbenchParts, 'spaces' | 'sessions' | 'activate'>) {
  function open(target: Target, options: { replace?: Id } = {}): Id | undefined {
    if (options.replace) {
      const space = spaces.spaceOf(options.replace)
      if (
        !space ||
        !spaces.dispatch(
          {
            type: 'updateTab',
            tabId: options.replace,
            patch: { target, title: null, remoteCwd: null },
          },
          space.id,
        )
      )
        return
      sessions.stop(options.replace)
      activate(options.replace)
      return options.replace
    }
    const row = newTabRow({ id: crypto.randomUUID(), title: null, target })
    if (!spaces.dispatch({ type: 'open', row })) return
    activate(row.id)
    return row.id
  }

  function openBeside(target: Target, anchorTabId: Id, edge: Edge = 'right'): Id | undefined {
    const space = spaces.spaceOf(anchorTabId)
    const anchor = space && rowOfTab(space, anchorTabId)
    if (!space || !anchor) return
    const row = newTabRow({ id: crypto.randomUUID(), title: null, target })
    if (
      !spaces.dispatch(
        [
          { type: 'open', row },
          { type: 'split', source: row.id, target: anchor.id, edge },
        ],
        space.id,
      )
    )
      return
    activate(row.id)
    return row.id
  }

  function splitWith(sourceTabId: Id, anchorTabId: Id, edge: Edge = 'right'): boolean {
    const space = spaces.spaceOf(anchorTabId)
    const source = space && rowOfTab(space, sourceTabId)
    const anchor = space && rowOfTab(space, anchorTabId)
    if (!space || !source || !anchor || source.kind !== 'tab') return false
    if (!spaces.dispatch({ type: 'split', source: source.id, target: anchor.id, edge }, space.id))
      return false
    activate(sourceTabId)
    return true
  }

  function detach(tabId: Id): boolean {
    const space = spaces.spaceOf(tabId)
    if (!space || !spaces.dispatch({ type: 'detach', tabId }, space.id)) return false
    activate(tabId, { wake: false })
    return true
  }

  return { open, openBeside, splitWith, detach }
}
