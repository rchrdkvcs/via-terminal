<script setup lang="ts">
import { computed } from 'vue'
import { Check } from '@lucide/vue'
import type { TabState } from '@/stores/sessions'

const props = defineProps<{ state: TabState; address: string }>()

const steps = computed(() => [
  { id: 'connecting', label: `Connexion à ${props.address}` },
  { id: 'verifying', label: 'Vérification du serveur' },
  { id: 'authenticating', label: 'Authentification' },
])
const current = computed(() => steps.value.findIndex((step) => step.id === props.state))
</script>

<template>
  <ol class="flex flex-col gap-2 text-[13px]" aria-live="polite">
    <li
      v-for="(step, index) in steps"
      :key="step.id"
      class="flex items-center gap-2.5 transition-colors duration-150"
      :class="index <= current ? 'text-foreground' : 'text-muted-foreground/60'"
    >
      <span class="grid size-4 place-items-center">
        <Check v-if="index < current" :size="14" :stroke-width="2" class="text-state-live" />
        <span
          v-else-if="index === current"
          class="size-3.5 animate-spin rounded-full border-[1.5px] border-state-pending border-e-transparent motion-reduce:animate-none"
        />
        <span v-else class="size-1.5 rounded-full bg-current" />
      </span>
      {{ step.label }}
    </li>
  </ol>
</template>
