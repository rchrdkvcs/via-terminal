<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTimeoutFn } from '@vueuse/core'
import { Keyboard, Palette, Settings2, Terminal } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { notify } from '@/lib/notify'
import { useSettings } from '@/stores/settings'
import PageShell, { type PageSection } from '@/components/page/PageShell.vue'
import AppearanceSection from './sections/AppearanceSection.vue'
import GeneralSection from './sections/GeneralSection.vue'
import ShortcutsSection from './sections/ShortcutsSection.vue'
import TerminalSection from './sections/TerminalSection.vue'

const settings = useSettings()

const sections = [
  { id: 'general', label: 'Général', icon: Settings2, view: GeneralSection },
  { id: 'appearance', label: 'Apparence', icon: Palette, view: AppearanceSection },
  { id: 'terminal', label: 'Terminal', icon: Terminal, view: TerminalSection },
  { id: 'shortcuts', label: 'Raccourcis', icon: Keyboard, view: ShortcutsSection },
] satisfies (PageSection & { view: unknown })[]

const current = ref('general')
const section = computed(() => sections.find((s) => s.id === current.value) ?? sections[0])

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
  <PageShell
    v-model="current"
    title="Réglages"
    close-label="Fermer les réglages"
    :sections="sections"
  >
    <div class="flex min-w-0 flex-1 flex-col">
      <ScrollArea class="min-h-0 flex-1">
        <div class="mx-auto flex w-full max-w-[640px] flex-col px-8 pt-5 pb-10">
          <h2 class="mb-4 text-[20px] font-semibold tracking-[-0.015em]">{{ section.label }}</h2>
          <component :is="section.view" />

          <div class="mt-8 flex items-center justify-between gap-6 pt-4">
            <p class="text-xs text-muted-foreground" aria-live="polite">
              {{ confirming ? 'Tous les réglages reprendront leur valeur initiale.' : '' }}
            </p>
            <Button :variant="confirming ? 'destructive' : 'secondary'" size="sm" @click="onReset">
              {{ confirming ? 'Confirmer' : 'Rétablir les valeurs par défaut' }}
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  </PageShell>
</template>
