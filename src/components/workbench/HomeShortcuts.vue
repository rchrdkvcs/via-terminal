<script setup lang="ts">
import type { Component } from 'vue'
import { Command, KeyRound, Settings } from '@lucide/vue'
import { Kbd } from '@/components/ui/kbd'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import type { ActionId } from '@/lib/shortcuts'
import { useUi } from '@/stores/ui'

const ui = useUi()
const kbd = useShortcutLabel()

const shortcuts: { id: ActionId; label: string; icon: Component; run: () => void }[] = [
  {
    id: 'actions',
    label: 'Actions',
    icon: Command,
    run: () => ui.openCommand({ kind: 'actions' }),
  },
  { id: 'vault', label: 'Coffre', icon: KeyRound, run: () => ui.showVault() },
  { id: 'settings', label: 'Réglages', icon: Settings, run: () => (ui.route = 'settings') },
]
</script>

<template>
  <nav class="flex flex-wrap items-center justify-center gap-1.5" aria-label="Raccourcis">
    <button
      v-for="shortcut in shortcuts"
      :key="shortcut.id"
      type="button"
      class="row flex h-8 items-center gap-2 px-2.5 text-[12.5px] text-ink-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/40"
      @click="shortcut.run"
    >
      <component :is="shortcut.icon" :size="14" :stroke-width="1.5" />
      {{ shortcut.label }}
      <Kbd>{{ kbd(shortcut.id) }}</Kbd>
    </button>
  </nav>
</template>
