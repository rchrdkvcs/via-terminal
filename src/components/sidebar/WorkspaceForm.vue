<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

    <div class="space-y-2">
      <div class="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 p-2">
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline" size="icon-sm" aria-label="Choisir une icône">
              <component :is="workspaceIcons[icon]" :size="14" :stroke-width="1.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" class="w-64 p-2">
            <div class="grid grid-cols-7 gap-1" role="radiogroup" aria-label="Icône">
              <Button
                v-for="value in workspaceIconNames"
                :key="value"
                variant="ghost"
                size="icon-sm"
                role="radio"
                :aria-checked="icon === value"
                :aria-label="value"
                :class="icon === value ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'"
                @click="selectIcon(value)"
              >
                <component :is="workspaceIcons[value]" :size="16" :stroke-width="1.5" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <Input
          v-model="name"
          autofocus
          class="h-8 border-sidebar-border bg-sidebar px-2 shadow-xs focus-visible:ring-2"
          placeholder="Nom de l’espace"
          aria-label="Nom de l’espace"
          @keydown.enter="submit"
        />
      </div>
      <div class="flex items-center gap-2 rounded-lg bg-sidebar-accent/50 p-2 text-sm">
        <span id="workspace-profile-label">Profil</span>
        <Select v-model="defaultShell">
          <SelectTrigger size="sm" class="ms-auto w-40" aria-labelledby="workspace-profile-label">
            <SelectValue placeholder="Choisir un profil" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="shell in shellOptions" :key="shell" :value="shell">
              {{ shell.split(/[\\/]/).pop() }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="mt-auto space-y-2">
      <Button class="w-full" :disabled="!name.trim() || submitting" @click="submit">
        <Check :size="15" />{{ existing ? 'Enregistrer' : 'Créer l’espace' }}
      </Button>
      <Button variant="secondary" class="w-full" @click="emit('close')">Annuler</Button>
    </div>
  </div>
</template>
