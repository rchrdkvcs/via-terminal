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

function overTree(event: DragEvent) {
  if (!activeDrag.value || activeDrag.value.type === 'tab') return
  acceptDrop(event)
  dropHint.value = 'tree:into'
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
}

function treeHint() {
  return dropHint.value === 'tree:into' ? 'rounded-md ring-2 ring-sidebar-ring ring-inset' : ''
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
            class="transition-colors"
            :class="[
              store.pinnedTabs.length || store.tree.length || draggingTab()
                ? 'min-h-12 p-2 py-1'
                : 'h-0 overflow-hidden',
              treeHint(),
            ]"
            aria-label="Épinglés et dossiers"
            @dragenter="overTree"
            @dragover="overTree"
            @drop="dropAtRoot"
          >
            <SessionRows pinned />
            <SidebarTree v-if="store.tree.length" :nodes="store.tree" />
            <div
              v-if="draggingTab() && !store.pinnedTabs.length && !store.tree.length"
              class="pointer-events-none flex h-8 items-center justify-center rounded-md border border-dashed border-sidebar-border text-xs text-sidebar-foreground/50"
            >
              Déposer ici pour épingler
            </div>
          </SidebarGroup>
          <SidebarSeparator
            v-if="store.pinnedTabs.length || store.tree.length || draggingTab()"
            class="mx-2 my-1"
          />
        </div>
      </Transition>

      <SidebarGroup class="p-2 py-1" aria-label="Sessions ouvertes">
        <SessionRows />
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter class="p-2">
      <WorkspaceBar @add-resource="emit('addResource')" />
    </SidebarFooter>
  </Sidebar>
</template>
