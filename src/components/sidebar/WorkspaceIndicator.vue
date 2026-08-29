<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { ChevronDown, Copy, FolderPlus, Pencil, Trash2 } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { workspaceIcon, workspaceIconNames, workspaceIcons } from '@/lib/icons'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{ addResource: [] }>()
const store = useAppStore()
const editing = ref(false)
const draft = ref('')
const input = ref<InstanceType<typeof Input> | null>(null)
const contextTrigger = ref<HTMLButtonElement | null>(null)
const menuOpen = ref(false)

async function beginRename() {
  if (!store.activeWorkspace) return
  draft.value = store.activeWorkspace.name
  editing.value = true
  await nextTick()
  const element = input.value?.$el as HTMLInputElement | undefined
  element?.focus()
  element?.select()
}

async function commitRename() {
  if (!editing.value || !store.activeWorkspace) return
  const value = draft.value.trim()
  editing.value = false
  if (value && value !== store.activeWorkspace.name) {
    await store.updateWorkspace(store.activeWorkspace.id, { name: value })
  }
}

function cancelRename() {
  editing.value = false
}

function cycleIcon() {
  const workspace = store.activeWorkspace
  if (!workspace) return
  const index = workspaceIconNames.indexOf(workspace.icon as (typeof workspaceIconNames)[number])
  const icon =
    workspaceIconNames[(index + 1 + workspaceIconNames.length) % workspaceIconNames.length]
  void store.updateWorkspace(workspace.id, { icon })
}

function openContextMenu() {
  menuOpen.value = false
  void nextTick(() => {
    menuOpen.value = true
  })
}
</script>

<template>
  <div class="relative flex w-full min-w-0 items-center">
    <Input
      v-if="editing"
      ref="input"
      v-model="draft"
      class="h-9 min-w-0 flex-1 border-0 bg-sidebar-accent/50 px-2 shadow-none"
      aria-label="Nom de l’espace de travail"
      @keydown.enter.prevent="commitRename"
      @keydown.esc.prevent="cancelRename"
      @blur="commitRename"
    />
    <button
      v-else
      class="flex h-8 w-full min-w-0 items-center gap-2 rounded-md p-2 text-start text-sm transition-colors hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
      :aria-expanded="!store.workspaceContentCollapsed"
      aria-controls="workspace-sidebar-content"
      @click="store.toggleWorkspaceContent()"
      @contextmenu.prevent="openContextMenu"
    >
      <component
        :is="workspaceIcon(store.activeWorkspace?.icon)"
        :size="16"
        :stroke-width="1.5"
        class="shrink-0"
        title="Double-cliquez pour changer l’icône"
        @dblclick.stop="cycleIcon"
      />
      <span class="min-w-0 flex-1 truncate font-medium" @dblclick.stop="beginRename">
        {{ store.activeWorkspace?.name ?? 'Aucun espace' }}
      </span>
      <ChevronDown
        :size="14"
        :stroke-width="1.5"
        class="shrink-0 text-sidebar-foreground/50 transition-transform duration-150"
        :class="store.workspaceContentCollapsed ? '-rotate-90' : ''"
      />
    </button>

    <DropdownMenu v-model:open="menuOpen">
      <DropdownMenuTrigger as-child>
        <button
          ref="contextTrigger"
          class="pointer-events-none absolute start-2 top-full size-px opacity-0"
          tabindex="-1"
          aria-hidden="true"
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="bottom" align="start" class="w-56">
        <DropdownMenuItem @select="beginRename">
          <Pencil :stroke-width="1.5" />Renommer
        </DropdownMenuItem>
        <DropdownMenuItem
          v-if="store.activeWorkspace"
          @select="
            store.duplicateWorkspace(
              store.activeWorkspace.id,
              `${store.activeWorkspace.name} (copie)`,
            )
          "
        >
          <Copy :stroke-width="1.5" />Dupliquer
        </DropdownMenuItem>
        <DropdownMenuItem @select="store.createFolder('Nouveau dossier')">
          <FolderPlus :stroke-width="1.5" />Nouveau dossier
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p class="px-2 py-1.5 text-xs font-medium text-muted-foreground">Changer l’icône</p>
        <div class="grid grid-cols-7 gap-1 px-2 pb-2" role="radiogroup" aria-label="Icône">
          <button
            v-for="name in workspaceIconNames"
            :key="name"
            role="radio"
            :aria-checked="store.activeWorkspace?.icon === name"
            :aria-label="name"
            class="grid aspect-square place-items-center rounded-md hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            :class="store.activeWorkspace?.icon === name ? 'bg-accent' : 'text-muted-foreground'"
            @click="
              store.activeWorkspace &&
              store.updateWorkspace(store.activeWorkspace.id, { icon: name })
            "
          >
            <component :is="workspaceIcons[name]" :size="14" :stroke-width="1.5" />
          </button>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem @select="emit('addResource')">Nouvelle ressource SSH</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          :disabled="store.workspaces.length <= 1"
          @select="
            store.activeWorkspace && (store.pendingWorkspaceDelete = store.activeWorkspace.id)
          "
        >
          <Trash2 :stroke-width="1.5" />Supprimer l’espace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
