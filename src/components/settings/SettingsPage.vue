<script setup lang="ts">
import { computed, ref } from 'vue'
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { Keyboard, Palette, Settings2, SquareTerminal, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { notify } from '@/lib/notify'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import SettingsRail, { type RailItem } from './SettingsRail.vue'
import AppearanceSection from './sections/AppearanceSection.vue'
import GeneralSection from './sections/GeneralSection.vue'
import ShortcutsSection from './sections/ShortcutsSection.vue'
import TerminalSection from './sections/TerminalSection.vue'

const settings = useSettings()
const ui = useUi()

const sections = [
  { id: 'general', label: 'Général', icon: Settings2, view: GeneralSection },
  { id: 'appearance', label: 'Apparence', icon: Palette, view: AppearanceSection },
  { id: 'terminal', label: 'Terminal', icon: SquareTerminal, view: TerminalSection },
  { id: 'shortcuts', label: 'Raccourcis', icon: Keyboard, view: ShortcutsSection },
] satisfies (RailItem & { view: unknown })[]

const current = ref('general')
const section = computed(() => sections.find((s) => s.id === current.value) ?? sections[0])

function close() {
  ui.route = 'workbench'
}

/** Escape inside an open menu or dialog belongs to that layer, not the page. */
useEventListener(window, 'keydown', (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || event.defaultPrevented) return
  const target = event.target instanceof Element ? event.target : null
  if (target?.closest('[role="listbox"], [role="menu"], [role="dialog"], [role="alertdialog"]'))
    return
  close()
})

/** Resetting is a two-step press so a stray click cannot undo every choice. */
const confirming = ref(false)
const { start: armTimeout, stop: disarm } = useTimeoutFn(() => (confirming.value = false), 4000, {
  immediate: false,
})

function onReset() {
  if (!confirming.value) {
    confirming.value = true
    armTimeout()
    return
  }
  disarm()
  confirming.value = false
  settings.reset()
  notify.success('Réglages rétablis')
}
</script>

<template>
  <div class="flex h-full min-h-0 font-sans text-foreground">
    <SettingsRail v-model="current" :items="sections" />

    <div class="flex min-w-0 flex-1 flex-col">
      <header class="relative flex h-12 shrink-0 items-center px-6">
        <h1 class="mx-auto w-full max-w-160 text-sm font-semibold">{{ section.label }}</h1>
        <Button
          variant="ghost"
          size="icon-sm"
          class="absolute top-2 right-3 text-muted-foreground"
          aria-label="Fermer les réglages"
          @click="close"
        >
          <X :stroke-width="1.5" aria-hidden="true" />
        </Button>
      </header>

      <ScrollArea class="min-h-0 flex-1">
        <div class="mx-auto flex w-full max-w-160 flex-col px-6 pb-10">
          <component :is="section.view" />

          <div class="mt-8 flex items-center justify-between gap-6 pt-4">
            <p class="text-xs text-muted-foreground" aria-live="polite">
              {{ confirming ? 'Tous les réglages reprendront leur valeur initiale.' : '' }}
            </p>
            <Button
              :variant="confirming ? 'destructive' : 'ghost'"
              size="sm"
              class="text-[13px]"
              :class="confirming ? '' : 'text-muted-foreground'"
              @click="onReset"
            >
              {{ confirming ? 'Confirmer' : 'Rétablir les valeurs par défaut' }}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  </div>
</template>
