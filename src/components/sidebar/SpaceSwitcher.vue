<script setup lang="ts">
import { KeyRound, Plus, Settings } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi, type Route } from '@/stores/ui'
import { spaceIcon } from './spaceIcons'

/** Spaces, then the vault and settings, at the foot of the sidebar. */
const spaces = useSpaces()
const settings = useSettings()
const ui = useUi()
const kbd = useShortcutLabel()

const digit = (index: number) =>
  settings.platform === 'macos' ? `⌘${index + 1}` : `Ctrl ${index + 1}`
const toggle = (route: Route) => (ui.route = ui.route === route ? 'workbench' : route)

/** The current choice is a lit key; the others stay flat until hovered. */
const button =
  'press grid size-7 shrink-0 place-items-center rounded-md text-ink-muted outline-none transition-[background-color,color,box-shadow] duration-100 hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-[current=true]:bg-control aria-[current=true]:text-foreground aria-[current=true]:shadow-[var(--shadow-control)]'
const tools = [
  { route: 'vault' as Route, label: 'Coffre', shortcut: 'vault' as const, icon: KeyRound },
  { route: 'settings' as Route, label: 'Réglages', shortcut: 'settings' as const, icon: Settings },
]
</script>

<template>
  <nav class="flex items-center gap-1" aria-label="Espaces">
    <div
      class="scrollbar-none -m-0.5 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto p-0.5"
    >
      <Tooltip v-for="(space, index) in spaces.spaces" :key="space.id">
        <TooltipTrigger as-child>
          <button
            type="button"
            :class="button"
            :aria-label="space.name"
            :aria-current="space.id === spaces.active.id ? 'true' : undefined"
            @click="spaces.activate(space.id)"
          >
            <component :is="spaceIcon(space.icon)" :size="15" :stroke-width="1.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {{ space.name
          }}<span v-if="index < 9" class="ms-2 text-ink-faint">{{ digit(index) }}</span>
        </TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            :class="button"
            aria-label="Nouvel espace"
            @click="ui.spaceForm = { id: null }"
          >
            <Plus :size="15" :stroke-width="1.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">Nouvel espace</TooltipContent>
      </Tooltip>
    </div>
    <Tooltip v-for="tool in tools" :key="tool.route">
      <TooltipTrigger as-child>
        <button
          type="button"
          :class="button"
          :aria-label="tool.label"
          :aria-current="ui.route === tool.route ? 'true' : undefined"
          @click="toggle(tool.route)"
        >
          <component :is="tool.icon" :size="15" :stroke-width="1.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {{ tool.label }}<span class="ms-2 text-ink-faint">{{ kbd(tool.shortcut) }}</span>
      </TooltipContent>
    </Tooltip>
  </nav>
</template>
