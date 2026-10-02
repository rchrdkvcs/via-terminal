<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { spaceIcons } from '@/domain/space-icons'
import { spaceIcon } from '@/components/sidebar/spaceIcons'
import { useSettings } from '@/stores/settings'
import { useSpaces, type SpaceDraft } from '@/stores/spaces'
import { useUi } from '@/stores/ui'

/** Create or edit a space: a name, an icon and the shell its new tabs use. */
const ui = useUi()
const spaces = useSpaces()
const settings = useSettings()
const SYSTEM = '__system__'
const draft = ref<SpaceDraft>({ name: '', icon: 'terminal', defaultShell: null })

const editing = computed(() => (ui.spaceForm?.id ? spaces.byId(ui.spaceForm.id) : undefined))
const open = computed({
  get: () => ui.spaceForm !== null,
  set: (value) => !value && (ui.spaceForm = null),
})
const shell = computed({
  get: () => draft.value.defaultShell ?? SYSTEM,
  set: (value: string) => (draft.value.defaultShell = value === SYSTEM ? null : value),
})

watch(open, (isOpen) => {
  if (!isOpen) return
  const space = editing.value
  draft.value = space
    ? { name: space.name, icon: space.icon, defaultShell: space.defaultShell }
    : { name: '', icon: 'terminal', defaultShell: null }
})

function submit() {
  const name = draft.value.name.trim()
  if (!name) return
  if (editing.value) spaces.update(editing.value.id, { ...draft.value, name })
  else spaces.create({ ...draft.value, name })
  ui.spaceForm = null
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="gap-5 sm:max-w-[420px]">
      <DialogHeader class="gap-1">
        <DialogTitle class="text-[15px]">
          {{ editing ? 'Modifier l’espace' : 'Nouvel espace' }}
        </DialogTitle>
        <DialogDescription class="text-[12.5px]">
          Un espace regroupe des onglets. Le coffre reste partagé entre tous les espaces.
        </DialogDescription>
      </DialogHeader>
      <form id="space-form" class="flex flex-col gap-4" @submit.prevent="submit">
        <div class="flex items-center gap-3">
          <span class="material-control grid size-10 shrink-0 place-items-center rounded-[10px]">
            <component :is="spaceIcon(draft.icon)" :size="18" :stroke-width="1.5" />
          </span>
          <Input
            v-model="draft.name"
            aria-label="Nom de l’espace"
            placeholder="Client Dupont, Maison, Labo…"
            class="h-9 text-[14px]"
            autofocus
          />
        </div>
        <fieldset
          class="material-sunken grid grid-cols-6 gap-1 rounded-xl p-1.5"
          aria-label="Icône"
        >
          <button
            v-for="icon in spaceIcons"
            :key="icon.id"
            type="button"
            :title="icon.label"
            :aria-label="icon.label"
            :aria-pressed="draft.icon === icon.id"
            class="press grid h-9 place-items-center rounded-lg text-ink-muted transition-[background-color,color,box-shadow] duration-100 hover:text-foreground aria-pressed:bg-control aria-pressed:text-foreground aria-pressed:shadow-[var(--shadow-control)]"
            @click="draft.icon = icon.id"
          >
            <component :is="spaceIcon(icon.id)" :size="16" :stroke-width="1.5" />
          </button>
        </fieldset>
        <label class="flex items-center justify-between gap-4 text-[13px]">
          <span>Shell des nouveaux onglets</span>
          <Select v-model="shell">
            <SelectTrigger class="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem :value="SYSTEM">Par défaut ({{ settings.shellName(null) }})</SelectItem>
              <SelectItem v-for="item in settings.shells" :key="item.path" :value="item.path">
                {{ item.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </label>
      </form>
      <DialogFooter class="gap-2">
        <Button variant="secondary" @click="ui.spaceForm = null">Annuler</Button>
        <Button type="submit" form="space-form" :disabled="!draft.name.trim()">
          {{ editing ? 'Enregistrer' : 'Créer l’espace' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
