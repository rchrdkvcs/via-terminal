<script setup lang="ts">
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import SessionRows from './SessionRows.vue'
import SidebarTree from './SidebarTree.vue'
import WorkspaceBar from './WorkspaceBar.vue'
import WorkspaceIndicator from './WorkspaceIndicator.vue'
import { useAppStore } from '@/stores/app'
import {
  acceptDrop,
  activeDrag,
  dropHint,
  endSidebarDrag,
  readSidebarDrag,
} from '@/lib/sidebar-dnd'

const emit = defineEmits<{ addResource: [] }>()

const store = useAppStore()

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey) return
  event.preventDefault()
  store.cycleWorkspace(event.deltaY > 0 ? 1 : -1)
}

/** The target behind a drag, so the favourites can refuse a folder. */
function targetIdOf(drag: NonNullable<typeof activeDrag.value>) {
  if (drag.type === 'favorite') return drag.targetId
  if (drag.type === 'node')
    return store.sidebarNodes.find((node) => node.id === drag.id)?.targetId ?? null
  const tab = store.tabs.find((item) => item.id === drag.id)
  const sessionId = tab && store.paneSessionIds(tab.root)[0]
  return sessionId ? (store.sessionById.get(sessionId)?.targetId ?? null) : null
}

/**
 * The blank space of a group appends to it. Rows stop their own drops, so this
 * only runs when the pointer misses every row — including on an empty list.
 */
function isPinnable(drag: NonNullable<typeof activeDrag.value>) {
  const targetId = targetIdOf(drag)
  return Boolean(targetId && store.resources.some((item) => item.id === targetId))
}

function overGroup(event: DragEvent, key: 'favorites' | 'tree') {
  const drag = activeDrag.value
  if (!drag) return
  if (key === 'favorites' && !isPinnable(drag)) return
  acceptDrop(event)
  dropHint.value = `${key}:into`
}

function dropInFavorites(event: DragEvent) {
  event.preventDefault()
  const drag = readSidebarDrag(event)
  endSidebarDrag()
  if (!drag) return
  if (drag.type === 'tab') {
    void store.pinTab(drag.id, null)
    return
  }
  const targetId = targetIdOf(drag)
  if (targetId) void store.pinTarget(targetId, null)
}

function dropAtRoot(event: DragEvent) {
  event.preventDefault()
  const drag = readSidebarDrag(event)
  endSidebarDrag()
  if (!drag) return
  if (drag.type === 'node') void store.reparentNode(drag.id, null, null)
  else if (drag.type === 'tab') void store.placeTab(drag.id, null, null)
  else void store.placeTarget(drag.targetId, null, null)
}

function groupHint(key: 'favorites' | 'tree') {
  return dropHint.value === `${key}:into` ? 'rounded-md ring-2 ring-sidebar-ring ring-inset' : ''
}

/** Leaving the sidebar entirely must not leave a drop marker behind. */
function onLeave(event: DragEvent) {
  const next = event.relatedTarget as Node | null
  if (!next || !(event.currentTarget as HTMLElement).contains(next)) dropHint.value = null
}
</script>

<template>
  <!--
    `collapsible="none"` because the shell animates this panel itself: pinned it
    sits in the flow, peeked it floats over the terminal so no reflow happens.
  -->
  <Sidebar
    collapsible="none"
    class="h-full w-full border-0 bg-transparent"
    @wheel="onWheel"
    @dragleave="onLeave"
    @dragend="endSidebarDrag()"
  >
    <SidebarHeader class="gap-0 p-2 pb-1">
      <WorkspaceIndicator @add-resource="emit('addResource')" />
    </SidebarHeader>

    <SidebarContent
      class="thin-scrollbar gap-0 overflow-x-hidden transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none"
      :class="[
        store.isSwitchingWorkspace
          ? store.workspaceSwitchDirection > 0
            ? 'animate-workspace-next'
            : 'animate-workspace-previous'
          : '',
      ]"
    >
      <!-- The workspace indicator only collapses persisted items, never open tabs or New terminal. -->
      <Transition
        enter-active-class="transition-[opacity,grid-template-rows] duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-100 ease-out"
        leave-to-class="opacity-0"
      >
        <div v-if="!store.workspaceContentCollapsed" id="workspace-sidebar-content">
          <SidebarGroup
            v-if="store.favorites.length || (activeDrag && isPinnable(activeDrag))"
            class="p-2 py-1"
            :class="[groupHint('favorites'), store.favorites.length ? '' : 'min-h-10']"
            aria-label="Favoris — déposez ici pour épingler"
            @dragenter="overGroup($event, 'favorites')"
            @dragover="overGroup($event, 'favorites')"
            @drop="dropInFavorites"
          >
            <SidebarTree :nodes="store.favorites" pinned />
          </SidebarGroup>

          <SidebarGroup
            v-if="store.tree.length"
            class="p-2 py-1"
            :class="groupHint('tree')"
            aria-label="Organisation de l’espace"
            @dragenter="overGroup($event, 'tree')"
            @dragover="overGroup($event, 'tree')"
            @drop="dropAtRoot"
          >
            <SidebarTree :nodes="store.tree" />
          </SidebarGroup>
          <SidebarSeparator v-if="store.favorites.length || store.tree.length" class="mx-2 my-1" />
        </div>
      </Transition>

      <SidebarGroup class="p-2 py-1">
        <SessionRows />
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter class="p-2">
      <WorkspaceBar @add-resource="emit('addResource')" />
    </SidebarFooter>
  </Sidebar>
</template>
