<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, FolderPlus, Lock, PanelLeftClose, Plus, Search, Server, Terminal } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import SidebarTree from './SidebarTree.vue'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{ addProfile: []; addResource: [] }>()

const store = useAppStore()
const newWorkspaceName = ref('')
const creatingWorkspace = ref(false)

const shownWorkspaces = computed(() => store.workspaces.slice(0, 6))
const overflowWorkspaces = computed(() => store.workspaces.slice(6))

function onWheel(event: WheelEvent) {
  if (!event.ctrlKey) return
  event.preventDefault()
  store.cycleWorkspace(event.deltaY > 0 ? 1 : -1)
}

/**
 * PRODUCT.md: a plain click focuses the session a favorite already owns, and a
 * secondary action opens another one.
 */
function openFavorite(
  favorite: { targetKind: 'profile' | 'resource'; targetId: string },
  event: MouseEvent,
) {
  void store.openTarget(favorite.targetKind, favorite.targetId, {
    reuse: !(event.ctrlKey || event.shiftKey),
  })
}

function submitWorkspace() {
  const name = newWorkspaceName.value
  newWorkspaceName.value = ''
  creatingWorkspace.value = false
  if (name.trim()) void store.createWorkspace(name)
}
</script>

<template>
  <!-- The root must stay a real element: App.vue animates this subtree. -->
  <aside
    class="flex w-64 shrink-0 flex-col border-e bg-sidebar text-sidebar-foreground"
    aria-label="Navigation principale"
    @wheel="onWheel"
  >
    <TooltipProvider :delay-duration="400">
      <!-- Region 1: window chrome -->
      <div class="flex h-11 shrink-0 items-center justify-end pe-2">
        <Button
          variant="ghost"
          size="icon-sm"
          class="active:scale-[0.96]"
          aria-label="Masquer la barre latérale"
          @click="store.sidebarVisible = false"
        >
          <PanelLeftClose :size="16" :stroke-width="1.5" />
        </Button>
      </div>

      <!-- Region 2: favorites, the fastest path to a session -->
      <section v-if="store.favorites.length" class="px-3 pb-4" aria-label="Favoris">
        <div class="grid grid-cols-3 gap-2">
          <Tooltip v-for="favorite in store.favorites" :key="favorite.id">
            <TooltipTrigger as-child>
              <button
                class="relative grid h-12 place-items-center rounded-xl border bg-card text-muted-foreground shadow-sm transition-[background-color,color,scale] duration-150 hover:bg-accent hover:text-foreground active:scale-[0.96]"
                @click="openFavorite(favorite, $event)"
              >
                <component
                  :is="favorite.targetKind === 'resource' ? Server : Terminal"
                  :size="18"
                  :stroke-width="1.5"
                />
                <span class="sr-only">{{ favorite.name }}</span>
                <span
                  v-if="favorite.sessionIds.length"
                  class="absolute bottom-1.5 end-1.5 size-1.5 rounded-full bg-success ring-2 ring-sidebar"
                  aria-hidden="true"
                />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {{ favorite.name }}
              <span v-if="favorite.sessionIds.length" class="text-muted-foreground">
                · {{ favorite.sessionIds.length }} ouverte(s)
              </span>
            </TooltipContent>
          </Tooltip>
        </div>
      </section>

      <!-- Region 3: workspace identity -->
      <header class="flex items-center justify-between gap-2 px-3 pb-2">
        <div class="min-w-0">
          <p class="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Espace de travail
          </p>
          <p class="truncate text-sm font-semibold">
            {{ store.activeWorkspace?.name ?? 'Aucun' }}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="active:scale-[0.96]"
              aria-label="Options de l’espace de travail"
            >
              <Plus :size="16" :stroke-width="1.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuItem @select="emit('addProfile')">
              <Terminal :size="14" :stroke-width="1.5" />
              Nouveau profil local
            </DropdownMenuItem>
            <DropdownMenuItem @select="emit('addResource')">
              <Server :size="14" :stroke-width="1.5" />
              Nouvelle ressource SSH
            </DropdownMenuItem>
            <DropdownMenuItem @select="store.createFolder('Nouveau dossier')">
              <FolderPlus :size="14" :stroke-width="1.5" />
              Nouveau dossier
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              :disabled="!store.activeWorkspace"
              @select="
                store.activeWorkspace &&
                store.duplicateWorkspace(
                  store.activeWorkspace.id,
                  `${store.activeWorkspace.name} (copie)`,
                )
              "
            >
              <Copy :size="14" :stroke-width="1.5" />
              Dupliquer l’espace de travail
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <!-- Region 4: the tree, the only region that scrolls -->
      <ScrollArea class="min-h-0 flex-1 px-2">
        <nav aria-label="Ressources et profils">
          <SidebarTree :nodes="store.tree" />
        </nav>

        <p
          v-if="!store.tree.length"
          class="px-2 py-6 text-center text-xs leading-relaxed text-muted-foreground"
        >
          Rien d’organisé pour l’instant.<br />
          Ajoutez un profil local ou une ressource SSH.
        </p>

        <button
          class="mt-2 flex h-(--row-height) w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground"
          @click="store.createTerminal()"
        >
          <Plus :size="15" :stroke-width="1.5" />
          Nouveau terminal
          <kbd class="ms-auto rounded border px-1 py-px font-mono text-[10px] text-muted-foreground"
            >Ctrl T</kbd
          >
        </button>
      </ScrollArea>

      <!-- Region 5: utilities and workspace switching -->
      <footer class="shrink-0 space-y-3 border-t p-2">
        <div class="space-y-px">
          <button
            class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground"
            @click="store.paletteOpen = true"
          >
            <Search :size="15" :stroke-width="1.5" />
            Rechercher
            <kbd class="ms-auto rounded border px-1 py-px font-mono text-[10px]">Ctrl K</kbd>
          </button>
          <button
            class="flex h-8 w-full items-center gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors duration-150 hover:bg-sidebar-accent hover:text-foreground"
            @click="store.lock()"
          >
            <Lock :size="15" :stroke-width="1.5" />
            Verrouiller
            <kbd class="ms-auto rounded border px-1 py-px font-mono text-[10px]">Ctrl Maj L</kbd>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-1.5" aria-label="Changer d’espace de travail">
          <Tooltip v-for="(workspace, index) in shownWorkspaces" :key="workspace.id">
            <TooltipTrigger as-child>
              <button
                class="relative grid size-8 place-items-center rounded-lg text-xs font-semibold uppercase transition-[background-color,color,box-shadow] duration-150 active:scale-[0.96]"
                :class="
                  workspace.id === store.activeWorkspaceId
                    ? 'bg-primary/20 text-primary shadow-[inset_0_0_0_1px_var(--primary)]'
                    : 'bg-accent text-muted-foreground hover:text-foreground'
                "
                :aria-current="workspace.id === store.activeWorkspaceId ? 'true' : undefined"
                :aria-label="workspace.name"
                @click="store.switchWorkspace(workspace.id)"
              >
                {{ workspace.name.slice(0, 2) }}
              </button>
            </TooltipTrigger>
            <TooltipContent>{{ workspace.name }} · Alt {{ index + 1 }}</TooltipContent>
          </Tooltip>

          <DropdownMenu v-if="overflowWorkspaces.length">
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon-sm" aria-label="Autres espaces de travail">
                …
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                v-for="workspace in overflowWorkspaces"
                :key="workspace.id"
                @select="store.switchWorkspace(workspace.id)"
              >
                {{ workspace.name }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            v-if="!creatingWorkspace"
            variant="ghost"
            size="icon-sm"
            class="active:scale-[0.96]"
            aria-label="Créer un espace de travail"
            @click="creatingWorkspace = true"
          >
            <Plus :size="16" :stroke-width="1.5" />
          </Button>
          <Input
            v-else
            v-model="newWorkspaceName"
            class="h-8 flex-1"
            placeholder="Nom"
            autofocus
            aria-label="Nom du nouvel espace de travail"
            @keydown.enter="submitWorkspace"
            @keydown.esc="creatingWorkspace = false"
            @blur="submitWorkspace"
          />
        </div>
      </footer>
    </TooltipProvider>
  </aside>
</template>
