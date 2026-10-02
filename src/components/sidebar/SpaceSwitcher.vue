<script setup lang="ts">
import { KeyRound, Plus, Settings } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { hueOf } from '@/domain/palette'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { spaceIcon } from './spaceIcons'

/** Spaces, then the vault, settings and a new space, at the foot of the sidebar. */
const spaces = useSpaces()
const ui = useUi()
const kbd = useShortcutLabel()

const button =
  'grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-row-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
</script>

<template>
  <nav class="flex items-center gap-1" aria-label="Espaces">
    <div class="scrollbar-none flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
      <Tooltip v-for="(space, index) in spaces.spaces" :key="space.id">
        <TooltipTrigger as-child>
          <button
            type="button"
            :class="[
              button,
              space.id === spaces.active.id ? 'bg-row-selected text-foreground shadow-row' : '',
            ]"
            :style="{
              color:
                space.id === spaces.active.id ? `oklch(0.7 0.13 ${hueOf(space.color)})` : undefined,
            }"
            :aria-label="space.name"
            :aria-current="space.id === spaces.active.id ? 'true' : undefined"
            @click="spaces.activate(space.id)"
          >
            <component :is="spaceIcon(space.icon)" :size="15" :stroke-width="1.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">
          {{ space.name
          }}<span v-if="index < 9" class="ms-2 text-muted-foreground">Ctrl {{ index + 1 }}</span>
        </TooltipContent>
      </Tooltip>
      <button
        type="button"
        :class="button"
        aria-label="Nouvel espace"
        @click="ui.spaceForm = { id: null }"
      >
        <Plus :size="15" :stroke-width="1.5" />
      </button>
    </div>
    <button
      type="button"
      :class="[button, ui.route === 'vault' ? 'bg-row-selected text-foreground' : '']"
      aria-label="Coffre"
      :title="`Coffre (${kbd('vault')})`"
      @click="ui.route = ui.route === 'vault' ? 'workbench' : 'vault'"
    >
      <KeyRound :size="15" :stroke-width="1.5" />
    </button>
    <button
      type="button"
      :class="[button, ui.route === 'settings' ? 'bg-row-selected text-foreground' : '']"
      aria-label="Réglages"
      :title="`Réglages (${kbd('settings')})`"
      @click="ui.route = ui.route === 'settings' ? 'workbench' : 'settings'"
    >
      <Settings :size="15" :stroke-width="1.5" />
    </button>
  </nav>
</template>
