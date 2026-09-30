<script setup lang="ts">
import { Terminal } from '@lucide/vue'
import { useAppStore } from '@/stores/app'
import type { NewTabTarget } from './types'

defineProps<{ busy?: boolean }>()
const emit = defineEmits<{ open: [target: NewTabTarget] }>()
const store = useAppStore()
</script>

<template>
  <div class="space-y-2">
    <p v-if="!store.workspaceProfiles.length" class="py-6 text-sm text-muted-foreground">
      Aucun profil de terminal disponible dans cet espace.
    </p>
    <button
      v-for="profile in store.workspaceProfiles"
      :key="profile.id"
      type="button"
      :disabled="busy"
      class="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-start hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
      @click="emit('open', { kind: 'profile', id: profile.id })"
    >
      <Terminal :size="18" :stroke-width="1.5" class="shrink-0 text-muted-foreground" />
      <span class="min-w-0 flex-1">
        <span class="block truncate text-sm font-medium">{{ profile.name }}</span>
        <span class="block truncate font-mono text-xs text-muted-foreground">{{
          profile.executable
        }}</span>
      </span>
      <span v-if="profile.id === store.defaultProfileId" class="text-xs text-muted-foreground"
        >Par défaut</span
      >
    </button>
  </div>
</template>
