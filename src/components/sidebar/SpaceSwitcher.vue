<script setup lang="ts">
import { Plus } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { spaceIcon } from './spaceIcons'

/** Spaces centered at the foot of the sidebar, New space on the right. */
const spaces = useSpaces()
const settings = useSettings()
const ui = useUi()

const digit = (index: number) =>
  settings.platform === 'macos' ? `⌘${index + 1}` : `Ctrl ${index + 1}`

/** The current choice is a lit key; the others stay flat until hovered. */
const button =
  'press grid size-7 shrink-0 place-items-center rounded-md text-ink-muted outline-none transition-[background-color,color,box-shadow] duration-100 hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-[current=true]:bg-control aria-[current=true]:text-foreground aria-[current=true]:shadow-[var(--shadow-control)]'
</script>

<template>
  <!-- An empty first column as wide as the + keeps the spaces centered in the sidebar. -->
  <nav
    class="grid grid-cols-[1.75rem_minmax(0,1fr)_1.75rem] items-center gap-1"
    aria-label="Espaces"
  >
    <div />
    <div class="scrollbar-none -m-0.5 flex min-w-0 overflow-x-auto p-0.5">
      <!-- Auto margins center the spaces, and fall to zero once they overflow. -->
      <div class="mx-auto flex w-max items-center gap-0.5">
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
      </div>
    </div>
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
  </nav>
</template>
