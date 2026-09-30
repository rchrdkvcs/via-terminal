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
import PinnedArea from './PinnedArea.vue'
import DropRowIndicator from './DropRowIndicator.vue'
import WorkspaceBar from './WorkspaceBar.vue'
import WorkspaceIndicator from './WorkspaceIndicator.vue'
import WorkspaceForm from './WorkspaceForm.vue'
import DropZone from '@/components/DropZone.vue'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowDownToLine, Plus } from '@lucide/vue'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useAppStore } from '@/stores/app'
import {
  activeDrag,
  clearDropHint,
  dropHint,
  registerSidebarDrop,
  setDropHint,
} from '@/lib/sidebar-dnd'
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'

const store = useAppStore()
const workspaceFormId = ref<string | undefined>()
const workspaceFormOpen = ref(false)
const pinnedDrop = ref<HTMLElement>()
let cleanupPinnedDrop: (() => void) | undefined
const contentScroll = ref<HTMLElement | { $el: HTMLElement }>()
let cleanupAutoScroll: (() => void) | undefined

function openWorkspaceForm(id?: string) {
  workspaceFormId.value = id
  workspaceFormOpen.value = true
}

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey) return
  event.preventDefault()
  store.cycleWorkspace(event.deltaY > 0 ? 1 : -1)
}

function dropAtRoot(drag: NonNullable<typeof activeDrag.value>) {
  if (drag.type === 'node') {
    void store.reparentNode(drag.id, null, null)
    return
  }
  if (drag.type === 'tab') void store.pinTab(drag.id, null)
  else if (drag.type === 'favorite') void store.pinTarget(drag.targetId, null)
}

watch(pinnedDrop, (element) => {
  cleanupPinnedDrop?.()
  cleanupPinnedDrop = element
    ? registerSidebarDrop(element, {
        onMove: () => setDropHint('pinned-root', 'tree:into'),
        onLeave: () => clearDropHint('pinned-root'),
        onDrop: (drag) => dropAtRoot(drag),
      })
    : undefined
})
onMounted(() => {
  const value = contentScroll.value
  const element = value instanceof HTMLElement ? value : value?.$el
  if (element)
    cleanupAutoScroll = autoScrollForElements({
      element,
      getAllowedAxis: () => 'vertical',
    })
})
onBeforeUnmount(() => cleanupPinnedDrop?.())
onBeforeUnmount(() => cleanupAutoScroll?.())

function hasPinnedItems() {
  return store.pinnedTabs.length > 0 || store.tree.length > 0
}
</script>

<template>
  <!--
    `collapsible="none"` because the shell animates this panel itself: pinned it
    sits in the flow, peeked it floats over the terminal so no reflow happens.
  -->
  <Sidebar collapsible="none" class="h-full w-full border-0 bg-transparent" @wheel="onWheel">
    <Transition name="workspace-mode" mode="out-in">
      <WorkspaceForm
        v-if="workspaceFormOpen"
        :workspace-id="workspaceFormId"
        @close="workspaceFormOpen = false"
      />

      <div v-else class="flex min-h-0 flex-1 flex-col">
        <SidebarHeader class="gap-0 p-2 pb-1">
          <WorkspaceIndicator />
        </SidebarHeader>

        <SidebarContent
          ref="contentScroll"
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
            <div
              v-if="!store.workspaceContentCollapsed && (hasPinnedItems() || activeDrag)"
              id="workspace-sidebar-content"
            >
              <SidebarGroup class="min-h-12 p-2 py-1" aria-label="Épinglés et dossiers">
                <div>
                  <PinnedArea />
                  <div
                    v-if="hasPinnedItems()"
                    ref="pinnedDrop"
                    data-drop-zone="pinned-root"
                    class="relative flex h-4 items-center justify-center"
                  >
                    <Transition name="drop-indicator">
                      <DropRowIndicator v-if="dropHint === 'tree:into'" position="after" />
                    </Transition>
                  </div>
                  <div v-else ref="pinnedDrop" data-drop-zone="pinned-root" class="my-1 min-h-24">
                    <DropZone
                      class="h-full min-h-24 border-sidebar-border bg-sidebar-accent/25 text-sidebar-foreground/50"
                      :class="
                        dropHint === 'tree:into'
                          ? 'border-sidebar-ring bg-sidebar-accent/60 text-sidebar-foreground/70'
                          : ''
                      "
                      :icon="ArrowDownToLine"
                      label="Déposez un onglet ici pour l’épingler"
                      :active="dropHint === 'tree:into'"
                    />
                  </div>
                </div>
              </SidebarGroup>
              <SidebarSeparator class="mx-2 my-1" />
            </div>
          </Transition>

          <SidebarGroup class="px-2 py-1" aria-label="Créer un onglet">
            <SidebarMenuItem>
              <SidebarMenuButton class="text-sidebar-foreground/70" @click="store.requestNewTab()">
                <Plus :stroke-width="1.5" />
                <span>Nouvel onglet</span>
                <KbdGroup class="ms-auto shrink-0">
                  <Kbd>Ctrl</Kbd>
                  <Kbd>T</Kbd>
                </KbdGroup>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarGroup>

          <SidebarGroup class="px-2 py-1" aria-label="Sessions ouvertes">
            <SessionRows />
          </SidebarGroup>
        </SidebarContent>
      </div>
    </Transition>

    <SidebarFooter class="p-2">
      <WorkspaceBar
        @create-workspace="openWorkspaceForm()"
        @edit-workspace="openWorkspaceForm($event)"
      />
    </SidebarFooter>
  </Sidebar>
</template>
