<script setup lang="ts">
import { computed } from 'vue'
import { Columns2, Copy, Layers, Lock, Rows2, Server, Settings, Terminal } from '@lucide/vue'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { useAppStore } from '@/stores/app'

const store = useAppStore()

interface Action {
  id: string
  label: string
  detail: string
  icon: unknown
  run: () => void
}

const targets = computed<Action[]>(() => {
  const flatten = (nodes: typeof store.tree): Action[] =>
    nodes.flatMap((node) => [
      ...(node.targetId
        ? [
            {
              id: `target-${node.id}`,
              label: node.label,
              detail:
                node.kind === 'resource'
                  ? store.describeTarget('resource', node.targetId)
                  : store.describeTarget('profile', node.targetId),
              icon: node.kind === 'resource' ? Server : Terminal,
              run: () =>
                store.openTarget(node.kind === 'resource' ? 'resource' : 'profile', node.targetId!),
            },
          ]
        : []),
      ...flatten(node.children),
    ])
  return flatten(store.tree)
})

const workspaceActions = computed<Action[]>(() =>
  store.workspaces.map((workspace, index) => ({
    id: `workspace-${workspace.id}`,
    label: workspace.name,
    detail: `Espace de travail · Alt ${index + 1}`,
    icon: Layers,
    run: () => store.switchWorkspace(workspace.id),
  })),
)

const commands = computed<Action[]>(() => [
  {
    id: 'new-terminal',
    label: 'Nouveau terminal',
    detail: 'Terminal par défaut · Ctrl T',
    icon: Terminal,
    run: () => store.createTerminal(),
  },
  {
    id: 'split-vertical',
    label: 'Diviser verticalement',
    detail: 'Panneau actif',
    icon: Columns2,
    run: () => store.splitActivePane('vertical'),
  },
  {
    id: 'split-horizontal',
    label: 'Diviser horizontalement',
    detail: 'Panneau actif',
    icon: Rows2,
    run: () => store.splitActivePane('horizontal'),
  },
  {
    id: 'new-window',
    label: 'Nouvelle fenêtre',
    detail: 'Ctrl Maj N',
    icon: Copy,
    run: () => store.openWindow(),
  },
  {
    id: 'settings',
    label: 'Ouvrir les réglages',
    detail: 'Apparence, terminal, sécurité',
    icon: Settings,
    run: () => {
      store.route = 'settings'
    },
  },
  {
    id: 'lock',
    label: 'Verrouiller Terminarr',
    detail: 'Ctrl Maj L',
    icon: Lock,
    run: () => store.lock(),
  },
])

function choose(action: Action) {
  store.paletteOpen = false
  action.run()
}
</script>

<template>
  <!--
    reka-ui's Listbox drives the palette, so arrow keys, Home/End, type-ahead
    and Enter all work without a hand-rolled selection index.
  -->
  <CommandDialog v-model:open="store.paletteOpen">
    <CommandInput placeholder="Rechercher une action, une ressource, un espace…" />
    <CommandList>
      <CommandEmpty>Aucun résultat.</CommandEmpty>

      <CommandGroup v-if="targets.length" heading="Ouvrir">
        <CommandItem
          v-for="action in targets"
          :key="action.id"
          :value="`${action.label} ${action.detail}`"
          @select="choose(action)"
        >
          <component :is="action.icon" :size="15" :stroke-width="1.5" />
          <span class="truncate">{{ action.label }}</span>
          <span class="ms-auto truncate text-xs text-muted-foreground">{{ action.detail }}</span>
        </CommandItem>
      </CommandGroup>

      <CommandGroup v-if="workspaceActions.length" heading="Espaces de travail">
        <CommandItem
          v-for="action in workspaceActions"
          :key="action.id"
          :value="`${action.label} ${action.detail}`"
          @select="choose(action)"
        >
          <component :is="action.icon" :size="15" :stroke-width="1.5" />
          <span class="truncate">{{ action.label }}</span>
          <span class="ms-auto truncate text-xs text-muted-foreground">{{ action.detail }}</span>
        </CommandItem>
      </CommandGroup>

      <CommandGroup heading="Commandes">
        <CommandItem
          v-for="action in commands"
          :key="action.id"
          :value="`${action.label} ${action.detail}`"
          @select="choose(action)"
        >
          <component :is="action.icon" :size="15" :stroke-width="1.5" />
          <span class="truncate">{{ action.label }}</span>
          <span class="ms-auto truncate text-xs text-muted-foreground">{{ action.detail }}</span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
