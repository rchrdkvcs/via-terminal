<script setup lang="ts">
import { computed } from 'vue'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { SettingsSection } from '@/stores/ui'
import SettingsReset from './SettingsReset.vue'
import AppearanceSection from './sections/AppearanceSection.vue'
import GeneralSection from './sections/GeneralSection.vue'
import ShortcutsSection from './sections/ShortcutsSection.vue'
import TerminalSection from './sections/TerminalSection.vue'

const props = defineProps<{ section: SettingsSection; label: string }>()

const views = {
  general: GeneralSection,
  appearance: AppearanceSection,
  terminal: TerminalSection,
  shortcuts: ShortcutsSection,
}
const view = computed(() => views[props.section])
</script>

<template>
  <ScrollArea class="min-h-0 min-w-0 flex-1">
    <div class="mx-auto flex w-full max-w-[720px] flex-col px-10 pt-8 pb-12">
      <h2 class="sr-only">{{ label }}</h2>
      <component :is="view" />
      <SettingsReset class="mt-10 self-start" />
    </div>
  </ScrollArea>
</template>
