import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api, describeError } from '@/ipc/client'
import type { Id, Layout } from '@/ipc/types'
import { apply, transfer as transferRow, type Intent } from '@/domain/organize'
import { type Space, fromPersisted, locate, rowOfTab, toPersisted } from '@/domain/space'
import { notify } from '@/lib/notify'

export interface SpaceDraft {
  name: string
  icon: string
  defaultShell: string | null
}

/**
 * Spaces and their rows. Every organization change is an intent applied by
 * `domain/organize`; this store only adds persistence of the pinned part.
 */
export const useSpaces = defineStore('spaces', () => {
  const spaces = ref<Space[]>([])
  const activeId = ref<Id>('')
  const sidebar = ref({ width: 264, visible: true })

  const active = computed(
    () => spaces.value.find((s) => s.id === activeId.value) ?? spaces.value[0],
  )

  function byId(id: Id): Space | undefined {
    return spaces.value.find((space) => space.id === id)
  }

  /** The space that owns a row or a tab. */
  function spaceOf(id: Id): Space | undefined {
    return spaces.value.find((space) => locate(space, id) ?? rowOfTab(space, id))
  }

  function hydrate(layout: Layout) {
    spaces.value = layout.spaces.map(fromPersisted)
    activeId.value = layout.activeSpaceId ?? layout.spaces[0]?.id ?? ''
    sidebar.value = { ...layout.sidebar }
  }

  let saving: ReturnType<typeof setTimeout> | undefined
  function persist() {
    clearTimeout(saving)
    saving = setTimeout(() => {
      const layout: Layout = {
        activeSpaceId: activeId.value,
        sidebar: sidebar.value,
        spaces: spaces.value.map(toPersisted),
      }
      api.saveLayout(layout).catch((cause) => {
        notify.error(`Organisation non enregistrée : ${describeError(cause)}`)
      })
    }, 250)
  }

  /** Apply an intent to a space; `false` when it was invalid and nothing changed. */
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

  function activate(id: Id) {
    if (!byId(id) || id === activeId.value) return
    activeId.value = id
    persist()
  }

  function cycle(direction: 1 | -1) {
    const index = spaces.value.findIndex((space) => space.id === active.value.id)
    const next = spaces.value[(index + direction + spaces.value.length) % spaces.value.length]
    if (next) activate(next.id)
  }

  function create(draft: SpaceDraft): Space {
    const space: Space = { id: crypto.randomUUID(), ...draft, pinned: [], temporary: [] }
    spaces.value.push(space)
    activate(space.id)
    persist()
    return space
  }

  function update(id: Id, draft: SpaceDraft) {
    const space = byId(id)
    if (!space) return
    Object.assign(space, draft)
    persist()
  }

  /** Remove organization only; workbench owns runtime cleanup. Never removes the last space. */
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

  /** Move a row to another space, keeping it pinned or temporary. */
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
    sidebar.value = { ...sidebar.value, ...patch }
    persist()
  }

  return {
    spaces,
    activeId,
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
  }
})
