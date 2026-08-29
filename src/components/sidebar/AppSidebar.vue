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

const emit = defineEmits<{ addProfile: []; addResource: [] }>()

const store = useAppStore()

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey) return
  event.preventDefault()
  store.cycleWorkspace(event.deltaY > 0 ? 1 : -1)
}
</script>

<template>
  <!--
    `collapsible="none"` because the shell animates this panel itself: pinned it
    sits in the flow, peeked it floats over the terminal so no reflow happens.
  -->
  <Sidebar collapsible="none" class="h-full w-full border-0 bg-transparent" @wheel="onWheel">
    <SidebarHeader class="gap-0 p-2 pb-1">
      <WorkspaceIndicator @add-profile="emit('addProfile')" @add-resource="emit('addResource')" />
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
          <SidebarGroup v-if="store.favorites.length" class="p-2 py-1">
            <SidebarTree :nodes="store.favorites" pinned />
          </SidebarGroup>

          <SidebarGroup class="p-2 py-1">
            <SidebarTree :nodes="store.tree" />
            <p
              v-if="!store.tree.length && !store.favorites.length"
              class="px-2 py-4 text-xs leading-relaxed text-sidebar-foreground/50"
            >
              Rien d’organisé pour l’instant. Ajoutez un profil local ou une ressource SSH avec le
              bouton ＋.
            </p>
          </SidebarGroup>
          <SidebarSeparator class="mx-2 my-1" />
        </div>
      </Transition>

      <SidebarGroup class="p-2 py-1">
        <SessionRows />
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter class="p-2">
      <WorkspaceBar @add-profile="emit('addProfile')" @add-resource="emit('addResource')" />
    </SidebarFooter>
  </Sidebar>
</template>
