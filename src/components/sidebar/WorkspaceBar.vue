<script setup lang="ts">
import { nextTick, ref } from 'vue'
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

const store = useAppStore()
const emit = defineEmits<{
  createWorkspace: []
  editWorkspace: [id: string]
}>()
const menuFor = ref<string | null>(null)
const draggingId = ref<string | null>(null)

function openWorkspaceMenu(id: string) {
  menuFor.value = null
  void nextTick(() => (menuFor.value = id))
}

function startDrag(event: DragEvent, id: string) {
  draggingId.value = id
  event.dataTransfer?.setData('application/x-terminarr-workspace', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function dropWorkspace(event: DragEvent, beforeId: string | null) {
  const id = event.dataTransfer?.getData('application/x-terminarr-workspace')
  draggingId.value = null
  if (!id || id === beforeId) return
  event.preventDefault()
  void store.reorderWorkspace(id, beforeId)
}
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
      class="no-scrollbar flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto scroll-smooth"
      @dragover.prevent
      @drop="dropWorkspace($event, null)"
    >
      <div
        v-for="(workspace, index) in store.workspaces"
        :key="workspace.id"
        class="workspace-switcher group relative shrink-0"
        :class="{
          'workspace-switcher--overflowing': store.workspaces.length > 7,
          'workspace-switcher--active': workspace.id === store.activeWorkspaceId,
        }"
        draggable="true"
        @dragstart="startDrag($event, workspace.id)"
        @dragend="draggingId = null"
        @dragover.prevent
        @drop.stop="dropWorkspace($event, workspace.id)"
      >
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
              @contextmenu.prevent="openWorkspaceMenu(workspace.id)"
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
