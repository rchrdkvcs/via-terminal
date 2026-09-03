<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowLeft, RotateCcw, Search } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription } from '@/components/ui/empty'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import { matchingSections, settingsSections } from './settingsPrototype'
import { useAppStore } from '@/stores/app'

defineEmits<{ addResource: []; restore: [] }>()
const store = useAppStore()
const filter = ref('')
const matches = computed(() => matchingSections(filter.value))
const active = computed(
  () => settingsSections.find((item) => item.id === store.settingsSection) ?? settingsSections[0],
)
</script>

<template>
  <div class="flex min-h-0 flex-1 gap-2">
    <nav class="flex w-60 shrink-0 flex-col px-3 pb-3" aria-label="Sections des réglages">
      <div class="flex h-16 items-center">
        <button
          class="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
          @click="store.route = 'workspace'"
        >
          <ArrowLeft :size="15" :stroke-width="1.5" />
          Retour au terminal
        </button>
      </div>
      <InputGroup class="mb-3">
        <InputGroupAddon><Search :size="14" :stroke-width="1.5" /></InputGroupAddon>
        <InputGroupInput
          v-model="filter"
          placeholder="Rechercher"
          aria-label="Rechercher un réglage"
        />
      </InputGroup>
      <div class="thin-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto">
        <button
          v-for="section in matches"
          :key="section.id"
          class="group flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-start transition-colors duration-150"
          :class="
            section.id === store.settingsSection
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
          "
          :aria-current="section.id === store.settingsSection ? 'page' : undefined"
          @click="store.settingsSection = section.id"
        >
          <component :is="section.icon" :size="16" :stroke-width="1.5" class="shrink-0" />
          <span class="min-w-0"
            ><span class="block truncate text-sm font-medium">{{ section.label }}</span
            ><span class="block truncate text-[11px] opacity-70">{{
              section.description
            }}</span></span
          >
        </button>
        <Empty v-if="!matches.length" class="border-0 px-2 py-6"
          ><EmptyDescription>Aucune section trouvée.</EmptyDescription></Empty
        >
      </div>
    </nav>

    <main
      class="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border/50 bg-card"
    >
      <header class="flex min-h-16 shrink-0 items-center justify-between gap-4 px-6">
        <div>
          <p class="text-xs font-medium text-muted-foreground">Réglages</p>
          <h1 class="text-lg font-semibold tracking-tight">{{ active.label }}</h1>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="gap-2 text-muted-foreground active:scale-[0.96]"
          @click="$emit('restore')"
          ><RotateCcw :size="14" :stroke-width="1.5" /><span class="hidden lg:inline"
            >Valeurs par défaut</span
          ></Button
        >
      </header>
      <div class="thin-scrollbar min-h-0 flex-1 overflow-y-auto border-t">
        <div class="mx-auto max-w-2xl px-6 py-8 pb-24">
          <Transition name="settings-section" mode="out-in"
            ><component :is="active.component" :key="active.id" @add="$emit('addResource')"
          /></Transition>
        </div>
      </div>
    </main>
  </div>
</template>
