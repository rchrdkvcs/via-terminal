<script setup lang="ts">
import { computed } from 'vue'
import { Search } from '@lucide/vue'
import { useTabLabel } from '@/composables/useTabLabel'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'

const ui = useUi()
const workbench = useWorkbench()
const names = useTabLabel()

const tab = computed(() => workbench.activeTab)
const text = computed(() => (tab.value ? names.detail(tab.value) : 'Rechercher ou se connecter'))

function open() {
  ui.openCommand(tab.value ? { kind: 'replace', tabId: tab.value.id } : { kind: 'new' })
}
</script>

<template>
  <button
    type="button"
    class="material-field flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-start text-[13px] text-ink-muted outline-none hover:text-foreground"
    :aria-label="tab ? `Changer la cible : ${text}` : 'Ouvrir la barre de commande'"
    @click="open"
  >
    <Search v-if="!tab" :size="14" :stroke-width="1.5" class="shrink-0" />
    <span class="min-w-0 flex-1 truncate" :class="tab ? 'text-foreground' : ''">{{ text }}</span>
  </button>
</template>
