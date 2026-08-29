<script setup lang="ts">
import { ref } from 'vue'
import { Check, Copy, FolderPlus, Lock, Plus, Server, Terminal } from '@lucide/vue'
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
const emit = defineEmits<{ addProfile: []; addResource: [] }>()

const creating = ref(false)
const draftName = ref('')
const draftIcon = ref('terminal')

function submit() {
  const name = draftName.value
  creating.value = false
  draftName.value = ''
  if (name.trim()) void store.createWorkspace(name, draftIcon.value)
  draftIcon.value = 'terminal'
}
</script>

<template>
  <!--
    One button per workspace. This row is both the switcher and the indicator of
    the current workspace; the header at the top of the sidebar repeats the same
    icon and adds the name.
  -->
  <div class="grid grid-cols-3 items-center gap-2 w-full">
    <div class="flex items-center justify-start">
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

    <div class="flex items-center justify-center gap-1 overflow-x-auto no-scrollbar">
      <Tooltip v-for="(workspace, index) in store.workspaces" :key="workspace.id">
        <TooltipTrigger as-child>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
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
                @contextmenu.prevent
              >
                <component :is="workspaceIcon(workspace.icon)" :size="16" :stroke-width="1.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem @select="store.switchWorkspace(workspace.id)">
                Ouvrir « {{ workspace.name }} »
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                @select="store.duplicateWorkspace(workspace.id, `${workspace.name} (copie)`)"
              >
                <Copy :stroke-width="1.5" />
                Dupliquer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TooltipTrigger>
        <TooltipContent side="top">{{ workspace.name }} · Alt {{ index + 1 }}</TooltipContent>
      </Tooltip>
    </div>

    <div class="flex items-center justify-end">
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
          <DropdownMenuItem @select="creating = true"
            ><Plus :stroke-width="1.5" />Nouvel espace de travail</DropdownMenuItem
          >
          <DropdownMenuSeparator />
          <DropdownMenuItem @select="emit('addProfile')"
            ><Terminal :stroke-width="1.5" />Nouveau profil local</DropdownMenuItem
          >
          <DropdownMenuItem @select="emit('addResource')"
            ><Server :stroke-width="1.5" />Nouvelle ressource SSH</DropdownMenuItem
          >
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <Dialog v-model:open="creating">
      <DialogContent class="sm:max-w-sm">
        <DialogHeader><DialogTitle>Nouvel espace de travail</DialogTitle></DialogHeader>
        <div class="space-y-3">
          <p class="text-sm font-medium">Nouvel espace de travail</p>
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
            Créer
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
