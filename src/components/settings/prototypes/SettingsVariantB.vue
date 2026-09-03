<script setup lang="ts">
import { ArrowLeft, RotateCcw, Search } from '@lucide/vue'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { matchingSections } from './settingsPrototype'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{ addResource: []; restore: [] }>()
const store = useAppStore()
const filter = ref('')
function restore(id: string) {
  store.settingsSection = id
  emit('restore')
}
function jumpTo(id: string) {
  document.getElementById(`settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-card">
    <header class="shrink-0 border-b bg-background/70 px-5 py-4 backdrop-blur-sm">
      <div class="mx-auto flex max-w-5xl items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Retour au terminal"
          @click="store.route = 'workspace'"
          ><ArrowLeft :size="17" :stroke-width="1.5"
        /></Button>
        <div class="min-w-0 flex-1">
          <h1 class="text-xl font-semibold tracking-tight">Réglages</h1>
          <p class="text-sm text-muted-foreground">Tout Via, dans une seule vue.</p>
        </div>
        <InputGroup class="hidden w-64 sm:flex"
          ><InputGroupAddon><Search :size="14" :stroke-width="1.5" /></InputGroupAddon
          ><InputGroupInput
            v-model="filter"
            placeholder="Filtrer les sections"
            aria-label="Filtrer les sections"
        /></InputGroup>
      </div>
      <div class="no-scrollbar mx-auto mt-4 flex max-w-5xl gap-2 overflow-x-auto pb-0.5">
        <button
          v-for="section in matchingSections(filter)"
          :key="section.id"
          class="flex h-8 shrink-0 items-center gap-2 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground hover:bg-accent active:scale-[0.96]"
          @click="jumpTo(section.id)"
        >
          <component :is="section.icon" :size="13" :stroke-width="1.5" />{{ section.label }}
        </button>
      </div>
    </header>
    <main class="thin-scrollbar min-h-0 flex-1 overflow-y-auto scroll-smooth">
      <div class="mx-auto max-w-5xl space-y-4 px-5 py-6 pb-24">
        <section
          v-for="section in matchingSections(filter)"
          :id="`settings-${section.id}`"
          :key="section.id"
          class="scroll-mt-5 rounded-xl bg-background p-5 shadow-[0_0_0_1px_oklch(0_0_0/0.08)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.1)] sm:p-6"
        >
          <div class="mb-2 flex items-center justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="grid size-9 place-items-center rounded-lg bg-secondary">
                <component :is="section.icon" :size="17" :stroke-width="1.5" />
              </div>
              <div>
                <h2 class="text-sm font-semibold">{{ section.label }}</h2>
                <p class="text-xs text-muted-foreground">{{ section.description }}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              :aria-label="`Rétablir ${section.label}`"
              class="text-muted-foreground"
              @click="restore(section.id)"
              ><RotateCcw :size="14" :stroke-width="1.5"
            /></Button>
          </div>
          <component :is="section.component" @add="emit('addResource')" />
        </section>
      </div>
    </main>
  </div>
</template>
