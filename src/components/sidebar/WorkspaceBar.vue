<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Check, Copy, FolderPlus, Lock, Pencil, Plus, Server, Terminal, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { workspaceIcon, workspaceIconNames, workspaceIcons } from '@/lib/icons'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const emit = defineEmits<{ addResource: [] }>()

const creating = ref(false)
const editingId = ref<string | null>(null)
const draftName = ref('')
const draftIcon = ref('terminal')
const menuFor = ref<string | null>(null)

function openWorkspaceMenu(id: string) {
  menuFor.value = null
  void nextTick(() => {
    menuFor.value = id
  })
}

function beginCreate() {
  editingId.value = null
  draftName.value = ''
  draftIcon.value = 'terminal'
  creating.value = true
}

function beginEdit(id: string) {
  const workspace = store.workspaces.find((item) => item.id === id)
  if (!workspace) return
  editingId.value = id
  draftName.value = workspace.name
  draftIcon.value = workspace.icon
  creating.value = true
}

function submit() {
  const name = draftName.value
  const icon = draftIcon.value
  const id = editingId.value
  creating.value = false
  draftName.value = ''
  draftIcon.value = 'terminal'
  editingId.value = null
  if (!name.trim()) return
  if (id) void store.updateWorkspace(id, { name, icon })
  else void store.createWorkspace(name, icon)
}
</script>

<template>
  <!--
    One button per workspace. This row is both the switcher and the indicator of
    the current workspace; the header at the top of the sidebar repeats the same
    icon and adds the name.
  -->
  <div class="flex w-full min-w-0 items-center gap-1">
    <div class="shrink-0">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-sidebar-foreground/60 active:scale-[0.96]"
            aria-label="Verrouiller Terminarr"
            @click="store.lock()"
          >
            <Lock :stroke-width="1.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Verrouiller · Ctrl Maj L</TooltipContent>
      </Tooltip>
    </div>

    <div
      class="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto no-scrollbar"
    >
      <div
        v-for="(workspace, index) in store.workspaces"
        :key="workspace.id"
        class="relative shrink-0"
      >
        <Tooltip>
          <TooltipTrigger as-child>
            <button
              class="grid size-7 shrink-0 place-items-center rounded-md transition-[background-color,color] duration-150 active:scale-[0.96]"
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
            <button
              class="pointer-events-none absolute inset-0 opacity-0"
              tabindex="-1"
              aria-hidden="true"
              @contextmenu.prevent
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" class="w-52">
            <DropdownMenuItem @select="beginEdit(workspace.id)">
              <Pencil :stroke-width="1.5" />Modifier
            </DropdownMenuItem>
            <DropdownMenuItem
              @select="store.duplicateWorkspace(workspace.id, `${workspace.name} (copie)`)"
            >
              <Copy :stroke-width="1.5" />Dupliquer
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

    <div class="shrink-0">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="shrink-0 text-sidebar-foreground/60 active:scale-[0.96]"
            aria-label="Ajouter"
          >
            <Plus :stroke-width="1.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="end" class="w-56">
          <DropdownMenuItem @select="store.createTerminal()"
            ><Terminal :stroke-width="1.5" />Nouveau terminal</DropdownMenuItem
          >
          <DropdownMenuItem @select="store.createFolder('Nouveau dossier')"
            ><FolderPlus :stroke-width="1.5" />Nouveau dossier</DropdownMenuItem
          >
          <DropdownMenuItem @select="beginCreate"
            ><Plus :stroke-width="1.5" />Nouvel espace de travail</DropdownMenuItem
          >
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="emit('addResource')"
            ><Server :stroke-width="1.5" />Nouvelle ressource SSH</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <Dialog v-model:open="creating">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{{
            editingId ? 'Modifier l’espace de travail' : 'Nouvel espace de travail'
          }}</DialogTitle>
        </DialogHeader>
        <div class="space-y-3">
          <Input
            v-model="draftName"
            placeholder="Nom"
            autofocus
            aria-label="Nom de l’espace de travail"
            @keydown.enter="submit"
          />
          <div class="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Icône">
            <button
              v-for="name in workspaceIconNames"
              :key="name"
              role="radio"
              :aria-checked="draftIcon === name"
              :aria-label="name"
              class="grid aspect-square place-items-center rounded-md transition-colors duration-150"
              :class="
                draftIcon === name
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60'
              "
              @click="draftIcon = name"
            >
              <component :is="workspaceIcons[name]" :size="15" :stroke-width="1.5" />
            </button>
          </div>
          <Button class="w-full active:scale-[0.96]" :disabled="!draftName.trim()" @click="submit">
            <Check :stroke-width="1.5" />
            {{ editingId ? 'Enregistrer' : 'Créer' }}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
