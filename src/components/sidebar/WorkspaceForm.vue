<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronLeft } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { workspaceIconNames, workspaceIcons } from '@/lib/icons'
import { useAppStore } from '@/stores/app'

const props = defineProps<{ workspaceId?: string }>()
const emit = defineEmits<{ close: [] }>()
const store = useAppStore()
const existing = computed(() =>
  props.workspaceId
    ? store.workspaces.find((workspace) => workspace.id === props.workspaceId)
    : null,
)
const name = ref(existing.value?.name ?? '')
const icon = ref(existing.value?.icon ?? 'terminal')
const existingProfile = computed(() =>
  existing.value?.defaultProfileId
    ? store.profiles.find((profile) => profile.id === existing.value?.defaultProfileId)
    : null,
)
const defaultShell = ref(existingProfile.value?.executable ?? store.settings.defaultShell)
const shellOptions = computed(() =>
  [...new Set([defaultShell.value, store.settings.defaultShell, ...store.detectedShells])].filter(
    Boolean,
  ),
)
const choosingIcon = ref(false)
const submitting = ref(false)

async function submit() {
  if (!name.value.trim() || submitting.value) return
  submitting.value = true
  try {
    if (existing.value)
      await store.updateWorkspace(existing.value.id, {
        name: name.value,
        icon: icon.value,
        defaultShell: defaultShell.value,
      })
    else await store.createWorkspace(name.value, icon.value, defaultShell.value)
    emit('close')
  } finally {
    submitting.value = false
  }
}

function selectIcon(value: string) {
  icon.value = value
  choosingIcon.value = false
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col px-2 pb-2 pt-7" @keydown.esc="emit('close')">
    <div class="mb-7 text-center">
      <h2 class="text-lg font-semibold">
        {{ existing ? 'Modifier l’espace' : 'Créer un espace' }}
      </h2>
      <p class="mt-1 text-xs leading-relaxed text-sidebar-foreground/50">
        Les espaces organisent vos onglets et vos connexions.
      </p>
    </div>

    <div v-if="choosingIcon" class="space-y-3">
      <Button variant="ghost" size="sm" class="gap-2" @click="choosingIcon = false">
        <ChevronLeft :size="15" />Retour
      </Button>
      <div class="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Icône">
        <button
          v-for="value in workspaceIconNames"
          :key="value"
          role="radio"
          :aria-checked="icon === value"
          :aria-label="value"
          class="grid aspect-square place-items-center rounded-md hover:bg-sidebar-accent"
          :class="icon === value ? 'bg-sidebar-accent text-sidebar-accent-foreground' : ''"
          @click="selectIcon(value)"
        >
          <component :is="workspaceIcons[value]" :size="16" :stroke-width="1.5" />
        </button>
      </div>
    </div>

    <div v-else class="space-y-2">
      <div class="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 p-2">
        <button
          class="grid size-6 shrink-0 place-items-center rounded border border-dashed border-sidebar-foreground/40"
          aria-label="Choisir une icône"
          @click="choosingIcon = true"
        >
          <component :is="workspaceIcons[icon]" :size="14" :stroke-width="1.5" />
        </button>
        <Input
          v-model="name"
          autofocus
          class="h-7 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          placeholder="Nom de l’espace"
          aria-label="Nom de l’espace"
          @keydown.enter="submit"
        />
      </div>
      <label class="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 p-2 text-sm">
        <span>Profil</span>
        <select
          v-model="defaultShell"
          class="ms-auto max-w-36 rounded-md bg-sidebar-accent px-2 py-1 text-xs"
        >
          <option v-for="shell in shellOptions" :key="shell" :value="shell">
            {{ shell.split(/[\\/]/).pop() }}
          </option>
        </select>
      </label>
    </div>

    <div class="mt-auto space-y-2">
      <Button class="w-full" :disabled="!name.trim() || submitting" @click="submit">
        <Check :size="15" />{{ existing ? 'Enregistrer' : 'Créer l’espace' }}
      </Button>
      <Button variant="secondary" class="w-full" @click="emit('close')">Annuler</Button>
    </div>
  </div>
</template>
