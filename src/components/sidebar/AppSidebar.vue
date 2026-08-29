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

function draggingTab() {
  return activeDrag.value?.type === 'tab'
}

function overGroup(event: DragEvent, key: 'pinned' | 'open' | 'tree') {
  if (key !== 'tree' && !draggingTab()) return
  if (key === 'tree' && !activeDrag.value) return
  acceptDrop(event)
  dropHint.value = `${key}:into`
}

function dropOnSection(event: DragEvent, pinned: boolean) {
  event.preventDefault()
  const drag = readSidebarDrag(event)
  endSidebarDrag()
  if (drag?.type !== 'tab') return
  if (pinned) void store.pinTab(drag.id)
  else void store.unpinTab(drag.id)
}

function firstFolder(nodes: typeof store.tree): (typeof store.tree)[number] | undefined {
  for (const node of nodes) {
    if (node.kind === 'folder') return node
    const nested = firstFolder(node.children)
    if (nested) return nested
  }
}

function dropAtRoot(event: DragEvent) {
  event.preventDefault()
  const drag = readSidebarDrag(event)
  endSidebarDrag()
  if (!drag) return
  if (drag.type === 'node') {
    void store.reparentNode(drag.id, null, null)
    return
  }
  if (drag.type === 'tab') {
    const folder = firstFolder(store.tree)
    if (folder) void store.placeTab(drag.id, folder.id, null)
  }
}

function groupHint(key: 'pinned' | 'open' | 'tree') {
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
      <!--
        Zen layout: pinned tabs, then saved unique SSH tabs in the tree,
        then the divider, then temporary open tabs. A saved SSH row is the
        unique tab itself — clicking it shows its CLI rather than spawning
        another row below the divider.
      -->
      <Transition
        enter-active-class="transition-[opacity,grid-template-rows] duration-150 ease-out"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-100 ease-out"
        leave-to-class="opacity-0"
      >
        <div v-if="!store.workspaceContentCollapsed" id="workspace-sidebar-content">
          <SidebarGroup
            v-if="store.pinnedTabs.length || draggingTab()"
            class="p-2 py-1 transition-colors"
            :class="[groupHint('pinned'), store.pinnedTabs.length ? '' : 'min-h-12']"
            aria-label="Onglets épinglés"
            @dragenter="overGroup($event, 'pinned')"
            @dragover="overGroup($event, 'pinned')"
            @drop="dropOnSection($event, true)"
          >
            <SessionRows pinned />
            <div
              v-if="draggingTab() && !store.pinnedTabs.length"
              class="pointer-events-none flex h-8 items-center justify-center rounded-md border border-dashed border-sidebar-border text-xs text-sidebar-foreground/50"
            >
              Déposer ici pour épingler
            </div>
          </SidebarGroup>
          <SidebarGroup
            v-if="store.tree.length"
            class="p-2 py-1"
            :class="groupHint('tree')"
            aria-label="Dossiers"
            @dragenter="overGroup($event, 'tree')"
            @dragover="overGroup($event, 'tree')"
            @drop="dropAtRoot"
          >
            <SidebarTree :nodes="store.tree" />
          </SidebarGroup>
          <SidebarSeparator
            v-if="store.pinnedTabs.length || store.tree.length || draggingTab()"
            class="mx-2 my-1"
          />
        </div>
      </Transition>

      <SidebarGroup
        class="p-2 py-1"
        :class="groupHint('open')"
        aria-label="Sessions ouvertes"
        @dragenter="overGroup($event, 'open')"
        @dragover="overGroup($event, 'open')"
        @drop="dropOnSection($event, false)"
      >
        <SessionRows />
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter class="p-2">
      <WorkspaceBar @add-resource="emit('addResource')" />
    </SidebarFooter>
  </Sidebar>
</template>
