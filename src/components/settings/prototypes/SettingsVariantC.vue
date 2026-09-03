<script setup lang="ts">
import { computed } from 'vue'
import { ArrowLeft, RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { settingsSections } from './settingsPrototype'
import { useAppStore } from '@/stores/app'

defineEmits<{ addResource: []; restore: [] }>()
const store = useAppStore()
const active = computed(
  () => settingsSections.find((item) => item.id === store.settingsSection) ?? settingsSections[0],
)
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col bg-card">
    <header class="flex h-14 shrink-0 items-center border-b px-4">
      <Button variant="ghost" size="sm" class="gap-2" @click="store.route = 'workspace'"
        ><ArrowLeft :size="15" :stroke-width="1.5" />Terminal</Button
      >
      <div class="mx-auto flex items-center gap-2 pe-20">
        <img src="/logo.svg" alt="" class="size-5 rounded" /><span class="text-sm font-semibold"
          >Réglages Via</span
        >
      </div>
    </header>
    <div class="thin-scrollbar min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto grid max-w-6xl gap-8 px-5 py-8 pb-24 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside class="lg:sticky lg:top-8 lg:self-start">
          <p class="mb-4 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
            Sommaire
          </p>
          <div class="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1">
            <button
              v-for="section in settingsSections"
              :key="section.id"
              class="flex min-h-12 items-center gap-3 rounded-lg px-3 text-start transition-colors duration-150"
              :class="
                section.id === active.id
                  ? 'bg-foreground text-background'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
              "
              @click="store.settingsSection = section.id"
            >
              <component :is="section.icon" :size="16" :stroke-width="1.5" class="shrink-0" />
              <span class="min-w-0"
                ><span class="block truncate text-sm font-medium">{{ section.label }}</span
                ><span class="hidden truncate text-[11px] opacity-70 lg:block">{{
                  section.description
                }}</span></span
              >
            </button>
          </div>
        </aside>
        <main class="min-w-0">
          <div class="mb-8 flex items-end justify-between gap-4">
            <div>
              <div class="mb-3 grid size-11 place-items-center rounded-xl bg-secondary">
                <component :is="active.icon" :size="20" :stroke-width="1.5" />
              </div>
              <p class="text-sm text-muted-foreground">{{ active.description }}</p>
              <h1 class="text-2xl font-semibold tracking-tight">{{ active.label }}</h1>
            </div>
            <Button
              variant="outline"
              size="sm"
              class="gap-2 active:scale-[0.96]"
              @click="$emit('restore')"
              ><RotateCcw :size="14" :stroke-width="1.5" /><span class="hidden sm:inline"
                >Valeurs par défaut</span
              ></Button
            >
          </div>
          <div
            class="rounded-xl bg-background p-5 shadow-[0_0_0_1px_oklch(0_0_0/0.08)] dark:shadow-[0_0_0_1px_oklch(1_0_0/0.1)] sm:p-7"
          >
            <Transition name="settings-section" mode="out-in"
              ><component :is="active.component" :key="active.id" @add="$emit('addResource')"
            /></Transition>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>
