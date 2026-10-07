import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, describeError, errorCode } from '@/ipc/client'
import type { Id, Layout } from '@/ipc/types'
import { apply, transfer as transferRow, type Intent } from '@/domain/organize'
import { LAYOUT_LIMITS, clampSidebarWidth, fitsLength } from '@/domain/limits'
import {
  type Space,
  fromPersisted,
  locate,
  newTabRow,
  rowOfTab,
  rows,
  tabs,
  tabsOf,
  toPersisted,
} from '@/domain/space'
import { clone } from '@/lib/clone'
import { notify } from '@/lib/notify'
import { deferredSave } from '@/lib/deferred-save'

export interface SpaceDraft {
  name: string
  icon: string
  defaultShell: string | null
}

export const useSpaces = defineStore('spaces', () => {
  const spaces = ref<Space[]>([])
  const activeId = ref<Id>('')
  const sidebar = ref({ width: 264, visible: true })

  const switchDirection = ref<1 | -1>(1)

  const active = computed(
    () => spaces.value.find((s) => s.id === activeId.value) ?? spaces.value[0],
  )

  function byId(id: Id): Space | undefined {
    return spaces.value.find((space) => space.id === id)
  }

  function spaceOf(id: Id): Space | undefined {
    return spaces.value.find((space) => locate(space, id) ?? rowOfTab(space, id))
  }

  let lastSaved: Layout | undefined

  function hydrate(layout: Layout) {
    lastSaved = clone(layout)
    spaces.value = layout.spaces.map(fromPersisted)
    activeId.value = layout.activeSpaceId ?? layout.spaces[0]?.id ?? ''
    sidebar.value = { ...layout.sidebar }
  }

  function restore(layout: Layout) {
    const current = spaces.value
    const previous = activeId.value
    hydrate(layout)
    const kept = new Set(spaces.value.flatMap((space) => tabs(space).map((tab) => tab.id)))
    for (const space of current) {
      const home = byId(space.id) ?? spaces.value[0]
      for (const row of rows(space)) {
        const missing = tabsOf(row).filter((tab) => !kept.has(tab.id))
        if (missing.length === tabsOf(row).length) home.temporary.push(row)
        else home.temporary.push(...missing.map(newTabRow))
      }
    }
    if (byId(previous)) activeId.value = previous
  }

  async function write(layout: Layout) {
    try {
      await api.saveLayout(layout)
      lastSaved = layout
    } catch (cause) {
      if (errorCode(cause) === 'invalid' && lastSaved) restore(clone(lastSaved))
      throw cause
    }
  }

  const persistence = deferredSave(
    (): Layout => ({
      activeSpaceId: activeId.value,
      sidebar: sidebar.value,
      spaces: spaces.value.map(toPersisted),
    }),
    write,
    (cause) => notify.error(`Organisation non enregistrée : ${describeError(cause)}`),
    250,
  )
  const persist = persistence.schedule

  function dispatch(
    intent: Intent | readonly Intent[],
    spaceId: Id | undefined = active.value?.id,
  ): boolean {
    const index = spaces.value.findIndex((space) => space.id === spaceId)
    const next = index >= 0 ? apply(spaces.value[index], intent) : null
    if (!next) return false
    spaces.value[index] = next
    persist()
    return true
  }

  function activate(id: Id, towards?: 1 | -1) {
    if (!byId(id) || id === activeId.value) return
    const index = (spaceId: Id) => spaces.value.findIndex((space) => space.id === spaceId)
    switchDirection.value = towards ?? (index(id) > index(activeId.value) ? 1 : -1)
    activeId.value = id
    persist()
  }

  function cycle(direction: 1 | -1) {
    const index = spaces.value.findIndex((space) => space.id === active.value.id)
    const next = spaces.value[(index + direction + spaces.value.length) % spaces.value.length]
    if (next) activate(next.id, direction)
  }

  const validName = (draft: SpaceDraft) => fitsLength(draft.name, LAYOUT_LIMITS.nameLength)

  function create(draft: SpaceDraft): Space | null {
    if (!validName(draft)) return null
    const space: Space = { id: crypto.randomUUID(), ...draft, pinned: [], temporary: [] }
    spaces.value.push(space)
    activate(space.id)
    persist()
    return space
  }

  function update(id: Id, draft: SpaceDraft) {
    const space = byId(id)
    if (!space || !validName(draft)) return
    Object.assign(space, draft)
    persist()
  }

  function remove(id: Id) {
    if (spaces.value.length <= 1) return false
    const index = spaces.value.findIndex((space) => space.id === id)
    if (index < 0) return false
    spaces.value.splice(index, 1)
    if (activeId.value === id) activeId.value = spaces.value[Math.max(0, index - 1)].id
    persist()
    return true
  }

  function reorder(id: Id, beforeId: Id | null) {
    const index = spaces.value.findIndex((space) => space.id === id)
    if (index < 0 || id === beforeId) return
    const [space] = spaces.value.splice(index, 1)
    const target = beforeId ? spaces.value.findIndex((s) => s.id === beforeId) : -1
    spaces.value.splice(target < 0 ? spaces.value.length : target, 0, space)
    persist()
  }

  function transfer(rowId: Id, toSpaceId: Id): boolean {
    const from = spaceOf(rowId)
    const destination = byId(toSpaceId)
    const moved = from && destination && transferRow(from, destination, rowId)
    if (!moved) return false
    const [source, target] = moved
    spaces.value = spaces.value.map((space) =>
      space.id === source.id ? source : space.id === target.id ? target : space,
    )
    persist()
    return true
  }

  function setSidebar(patch: Partial<{ width: number; visible: boolean }>) {
    const next = { ...sidebar.value, ...patch }
    sidebar.value = { ...next, width: clampSidebarWidth(next.width) }
    persist()
  }

  return {
    spaces,
    activeId,
    switchDirection,
    active,
    sidebar,
    byId,
    spaceOf,
    hydrate,
    dispatch,
    activate,
    cycle,
    create,
    update,
    remove,
    reorder,
    transfer,
    setSidebar,
    flush: persistence.flush,
  }
})
