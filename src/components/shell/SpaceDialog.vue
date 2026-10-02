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
import { spaceColors, spaceIcons } from '@/domain/palette'
import { spaceIcon } from '@/components/sidebar/spaceIcons'
import { useSettings } from '@/stores/settings'
import { useSpaces, type SpaceDraft } from '@/stores/spaces'
import { useUi } from '@/stores/ui'

/** Create or edit a space: name, icon, color and the shell its new tabs use. */
const ui = useUi()
const spaces = useSpaces()
const settings = useSettings()
const SYSTEM = '__system__'
const draft = ref<SpaceDraft>({ name: '', icon: 'terminal', color: 'ocean', defaultShell: null })

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
    ? { name: space.name, icon: space.icon, color: space.color, defaultShell: space.defaultShell }
    : {
        name: '',
        icon: 'terminal',
        color: spaceColors[(spaces.spaces.length + 1) % spaceColors.length].id,
        defaultShell: null,
      }
})

function submit() {
  const name = draft.value.name.trim()
  if (!name) return
  if (editing.value) spaces.update(editing.value.id, { ...draft.value, name })
  else spaces.create({ ...draft.value, name })
  ui.spaceForm = null
}

const swatch = (hue: number) => ({ background: `oklch(0.68 0.13 ${hue})` })
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ editing ? 'Modifier l’espace' : 'Nouvel espace' }}</DialogTitle>
        <DialogDescription>
          Un espace regroupe des onglets. Les hôtes du coffre restent partagés entre tous les
          espaces.
        </DialogDescription>
      </DialogHeader>
      <form id="space-form" class="flex flex-col gap-4" @submit.prevent="submit">
        <Input
          v-model="draft.name"
          aria-label="Nom de l’espace"
          placeholder="Nom, par exemple Client Dupont"
          autofocus
        />
        <fieldset class="flex flex-wrap gap-1" aria-label="Icône">
          <button
            v-for="icon in spaceIcons"
            :key="icon.id"
            type="button"
            :aria-label="icon.label"
            :aria-pressed="draft.icon === icon.id"
            class="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-row-hover aria-pressed:bg-row-selected aria-pressed:text-foreground aria-pressed:shadow-row"
            @click="draft.icon = icon.id"
          >
            <component :is="spaceIcon(icon.id)" :size="16" :stroke-width="1.5" />
          </button>
        </fieldset>
        <fieldset class="flex gap-2" aria-label="Couleur">
          <button
            v-for="color in spaceColors"
            :key="color.id"
            type="button"
            :aria-label="color.label"
            :aria-pressed="draft.color === color.id"
            class="size-6 rounded-full ring-offset-2 ring-offset-popover transition-shadow aria-pressed:ring-2 aria-pressed:ring-foreground"
            :style="swatch(color.hue)"
            @click="draft.color = color.id"
          />
        </fieldset>
        <label class="flex flex-col gap-1.5 text-[13px]">
          <span class="text-muted-foreground">Shell des nouveaux onglets</span>
          <Select v-model="shell">
            <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem :value="SYSTEM"
                >Shell par défaut ({{ settings.shellName(null) }})</SelectItem
              >
              <SelectItem v-for="item in settings.shells" :key="item.path" :value="item.path">{{
                item.name
              }}</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </form>
      <DialogFooter>
        <Button variant="ghost" @click="ui.spaceForm = null">Annuler</Button>
        <Button type="submit" form="space-form" :disabled="!draft.name.trim()">
          {{ editing ? 'Enregistrer' : 'Créer l’espace' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
