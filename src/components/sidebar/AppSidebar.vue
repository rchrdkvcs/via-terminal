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
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ArrowDownToLine, Plus } from '@lucide/vue'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useAppStore } from '@/stores/app'
import { activeDrag, dropHint, registerSidebarDrop } from '@/lib/sidebar-dnd'
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'

const emit = defineEmits<{ addResource: [] }>()

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
        onMove: () => (dropHint.value = 'tree:into'),
        onLeave: () => (dropHint.value = null),
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
    <SidebarHeader v-if="!workspaceFormOpen" class="gap-0 p-2 pb-1">
      <WorkspaceIndicator @add-resource="emit('addResource')" />
    </SidebarHeader>

    <WorkspaceForm
      v-if="workspaceFormOpen"
      :workspace-id="workspaceFormId"
      @close="workspaceFormOpen = false"
    />

    <SidebarContent
      v-else
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
        <div v-if="!store.workspaceContentCollapsed" id="workspace-sidebar-content">
          <SidebarGroup class="min-h-12 p-2 py-1" aria-label="Épinglés et dossiers">
            <div>
              <PinnedArea />
              <div
                ref="pinnedDrop"
                data-drop-zone="pinned-root"
                class="relative flex items-center justify-center text-sidebar-foreground/50 transition-[background-color,border-color,color] duration-100"
                :class="
                  hasPinnedItems()
                    ? 'h-4'
                    : [
                        'my-1 min-h-24 flex-col gap-2 rounded-xl border border-dashed border-sidebar-border bg-sidebar-accent/25 px-4 text-center',
                        dropHint === 'tree:into'
                          ? 'border-sidebar-ring bg-sidebar-accent/60 text-sidebar-foreground/70'
                          : '',
                      ]
                "
              >
                <template v-if="!hasPinnedItems()">
                  <ArrowDownToLine :size="20" :stroke-width="1.5" aria-hidden="true" />
                  <span class="text-sm">Déposez un onglet ici pour l’épingler</span>
                </template>
                <DropRowIndicator v-else-if="dropHint === 'tree:into'" position="after" />
              </div>
            </div>
          </SidebarGroup>
          <SidebarSeparator class="mx-2 my-1" />
        </div>
      </Transition>

      <SidebarGroup class="px-2 py-1" aria-label="Créer un terminal">
        <SidebarMenuItem>
          <SidebarMenuButton class="text-sidebar-foreground/70" @click="store.createTerminal()">
            <Plus :stroke-width="1.5" />
            <span>Nouveau terminal</span>
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

    <SidebarFooter class="p-2">
      <WorkspaceBar
        @create-workspace="openWorkspaceForm()"
        @edit-workspace="openWorkspaceForm($event)"
      />
    </SidebarFooter>
  </Sidebar>
</template>
