<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, type ObjectDirective } from 'vue'
import { FolderPlus, Lock, Pencil, Plus, Terminal, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { workspaceIcon } from '@/lib/icons'
import { useAppStore } from '@/stores/app'
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter'
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine'
import { autoScrollForElements } from '@atlaskit/pragmatic-drag-and-drop-auto-scroll/element'

const store = useAppStore()
const emit = defineEmits<{
  createWorkspace: []
  editWorkspace: [id: string]
}>()
const menuFor = ref<string | null>(null)
const draggingId = ref<string | null>(null)
const dropHint = ref<{ id: string; side: 'before' | 'after' } | null>(null)
const workspaceStrip = ref<HTMLElement>()
let cleanupStrip: (() => void) | undefined

function openWorkspaceMenu(id: string) {
  menuFor.value = null
  void nextTick(() => (menuFor.value = id))
}

function workspaceId(data: Record<string, unknown>) {
  return data.type === 'workspace' && typeof data.id === 'string' ? data.id : null
}

function dropWorkspace(id: string, beforeId: string | null) {
  draggingId.value = null
  dropHint.value = null
  if (!id || id === beforeId) return
  void store.reorderWorkspace(id, beforeId)
}

const workspaceCleanups = new WeakMap<HTMLElement, () => void>()
const vWorkspaceDrag: ObjectDirective<HTMLElement, string> = {
  mounted(element, { value: id }) {
    workspaceCleanups.set(
      element,
      combine(
        draggable({
          element,
          getInitialData: () => ({ type: 'workspace', id }),
          onDragStart: () => (draggingId.value = id),
          onDrop: () => (draggingId.value = null),
        }),
        dropTargetForElements({
          element,
          canDrop: ({ source }) => Boolean(workspaceId(source.data)),
          onDrag: ({ location }) => {
            if (location.current.dropTargets[0]?.element !== element) return
            const bounds = element.getBoundingClientRect()
            dropHint.value = {
              id,
              side:
                location.current.input.clientX < bounds.left + bounds.width / 2
                  ? 'before'
                  : 'after',
            }
          },
          onDragLeave: () => {
            if (dropHint.value?.id === id) dropHint.value = null
          },
          onDrop: ({ source, location }) => {
            if (location.current.dropTargets[0]?.element !== element) return
            const sourceId = workspaceId(source.data)
            const side = dropHint.value?.id === id ? dropHint.value.side : 'before'
            const index = store.workspaces.findIndex((workspace) => workspace.id === id)
            const beforeId = side === 'before' ? id : (store.workspaces[index + 1]?.id ?? null)
            if (sourceId) dropWorkspace(sourceId, beforeId)
          },
        }),
      ),
    )
  },
  unmounted(element) {
    workspaceCleanups.get(element)?.()
  },
}

onMounted(() => {
  if (!workspaceStrip.value) return
  cleanupStrip = combine(
    dropTargetForElements({
      element: workspaceStrip.value,
      canDrop: ({ source }) => Boolean(workspaceId(source.data)),
      onDrop: ({ source, location }) => {
        if (location.current.dropTargets[0]?.element !== workspaceStrip.value) return
        const sourceId = workspaceId(source.data)
        if (sourceId) dropWorkspace(sourceId, null)
      },
    }),
    autoScrollForElements({
      element: workspaceStrip.value,
      getAllowedAxis: () => 'horizontal',
    }),
  )
})
onBeforeUnmount(() => cleanupStrip?.())
</script>

<template>
  <div class="flex w-full min-w-0 items-center gap-1">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          class="shrink-0 text-sidebar-foreground/60"
          aria-label="Verrouiller Terminarr"
          @click="store.lock()"
        >
          <Lock :stroke-width="1.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Verrouiller · Ctrl Maj L</TooltipContent>
    </Tooltip>

    <div
      ref="workspaceStrip"
      class="no-scrollbar flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto scroll-smooth"
    >
      <div
        v-for="(workspace, index) in store.workspaces"
        v-workspace-drag="workspace.id"
        :key="workspace.id"
        class="workspace-switcher group relative shrink-0"
        :class="{
          'workspace-switcher--overflowing': store.workspaces.length > 7,
          'workspace-switcher--active': workspace.id === store.activeWorkspaceId,
        }"
      >
        <span
          v-if="dropHint?.id === workspace.id"
          class="pointer-events-none absolute inset-y-1 z-10 w-0.5 rounded-full bg-sidebar-primary"
          :class="dropHint.side === 'before' ? '-left-0.5' : '-right-0.5'"
        />
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              class="grid size-7 place-items-center rounded-md transition-[background-color,color,transform,opacity] duration-150"
              :class="
                workspace.id === store.activeWorkspaceId
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground'
              "
              :aria-current="workspace.id === store.activeWorkspaceId ? 'true' : undefined"
              :aria-label="workspace.name"
              @click="store.switchWorkspace(workspace.id)"
              @contextmenu.stop.prevent="openWorkspaceMenu(workspace.id)"
            >
              <component :is="workspaceIcon(workspace.icon)" :size="16" :stroke-width="1.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">{{ workspace.name }} · Alt {{ index + 1 }}</TooltipContent>
        </Tooltip>

        <DropdownMenu
          :open="menuFor === workspace.id"
          @update:open="(open) => (menuFor = open ? workspace.id : null)"
        >
          <DropdownMenuTrigger as-child>
            <button class="pointer-events-none absolute inset-0 opacity-0" tabindex="-1" />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" class="w-52">
            <DropdownMenuItem @select="emit('editWorkspace', workspace.id)">
              <Pencil :stroke-width="1.5" />Modifier
            </DropdownMenuItem>
            <DropdownMenuItem @select="store.createTerminal()">
              <Terminal :stroke-width="1.5" />Nouveau terminal
            </DropdownMenuItem>
            <DropdownMenuItem @select="store.createFolder('Nouveau dossier')">
              <FolderPlus :stroke-width="1.5" />Nouveau dossier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              :disabled="store.workspaces.length <= 1"
              @select="store.pendingWorkspaceDelete = workspace.id"
            >
              <Trash2 :stroke-width="1.5" />Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>

    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-sm"
          class="shrink-0 text-sidebar-foreground/60"
          aria-label="Ajouter"
        >
          <Plus :stroke-width="1.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="end" class="w-56">
        <DropdownMenuItem @select="store.createTerminal()">
          <Terminal :stroke-width="1.5" />Nouveau terminal
        </DropdownMenuItem>
        <DropdownMenuItem @select="store.createFolder('Nouveau dossier')">
          <FolderPlus :stroke-width="1.5" />Nouveau dossier
        </DropdownMenuItem>
        <DropdownMenuItem @select="emit('createWorkspace')">
          <Plus :stroke-width="1.5" />Nouvel espace de travail
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
