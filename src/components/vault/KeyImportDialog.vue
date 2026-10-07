<script setup lang="ts">
import { FileUp } from '@lucide/vue'
import { computed, ref, useTemplateRef, watch } from 'vue'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { api, describeError, errorCode } from '@/ipc/client'
import type { Id } from '@/ipc/types'
import { notify } from '@/lib/notify'
import { useVault } from '@/stores/vault'
import VaultField from './VaultField.vue'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ imported: [id: Id] }>()
const vault = useVault()
const label = ref('')
const privateKey = ref('')
const passphrase = ref('')
const remember = ref(false)
const needsPassphrase = ref(false)
const error = ref<string | null>(null)
const busy = ref(false)
const file = useTemplateRef('file')

watch(open, (now) => {
  if (!now) return
  label.value = privateKey.value = passphrase.value = ''
  needsPassphrase.value = remember.value = false
  error.value = null
})

function pick(event: Event) {
  const target = event.target as HTMLInputElement
  const chosen = target.files?.[0]
  target.value = ''
  if (!chosen) return
  const reader = new FileReader()
  reader.onload = () => {
    privateKey.value = String(reader.result ?? '')
    label.value ||= chosen.name
    error.value = null
  }
  reader.onerror = () =>
    (error.value = `Impossible de lire « ${chosen.name} ». Vérifiez qu’il s’agit bien d’un fichier texte.`)
  reader.readAsText(chosen)
}

const ready = computed(
  () => privateKey.value.trim() && (!needsPassphrase.value || passphrase.value),
)

async function submit() {
  if (!ready.value) return
  busy.value = true
  const input = {
    label: label.value.trim() || 'Clé importée',
    privateKey: privateKey.value,
    passphrase: needsPassphrase.value ? passphrase.value : null,
    rememberPassphrase: needsPassphrase.value && remember.value,
  }
  try {
    const id = await vault.mutate(() => api.vault.importKey(input))
    notify.success('Clé importée')
    open.value = false
    if (id) emit('imported', id)
  } catch (cause) {
    if (errorCode(cause) === 'passphrase_required') {
      needsPassphrase.value = true
      error.value = 'Cette clé est protégée par une phrase de passe. Saisissez-la pour l’importer.'
    } else {
      error.value = describeError(cause)
    }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="bg-surface sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="text-sm">Importer une clé</DialogTitle>
        <DialogDescription class="text-xs">
          Collez la clé privée ou choisissez son fichier. Son contenu est copié dans le coffre,
          chiffré.
        </DialogDescription>
      </DialogHeader>
      <form id="key-import" class="grid gap-3.5" @submit.prevent="submit">
        <VaultField label="Libellé" for="key-import-label">
          <Input
            id="key-import-label"
            v-model="label"
            placeholder="Clé importée"
            class="h-8 text-[13px] md:text-[13px]"
          />
        </VaultField>
        <VaultField label="Clé privée" for="key-import-content">
          <Textarea
            id="key-import-content"
            v-model="privateKey"
            spellcheck="false"
            placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
            class="max-h-40 min-h-24 font-mono text-xs md:text-xs"
          />
        </VaultField>
        <input
          ref="file"
          type="file"
          class="hidden"
          tabindex="-1"
          aria-hidden="true"
          @change="pick"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          class="justify-self-start"
          @click="file?.click()"
        >
          <FileUp :stroke-width="1.5" />
          Choisir un fichier
        </Button>
        <template v-if="needsPassphrase">
          <VaultField label="Phrase de passe" for="key-import-passphrase">
            <Input
              id="key-import-passphrase"
              v-model="passphrase"
              type="password"
              autofocus
              class="h-8 text-[13px] md:text-[13px]"
            />
          </VaultField>
          <label class="flex items-center gap-2 text-[13px]">
            <Switch v-model="remember" :disabled="!vault.view.secretsAvailable" />
            Mémoriser la phrase de passe
          </label>
          <p v-if="!vault.view.secretsAvailable" class="text-muted-foreground text-xs">
            Aucun trousseau système n’est disponible : la phrase de passe sera demandée à chaque
            connexion.
          </p>
        </template>
        <p v-if="error" role="alert" class="text-destructive text-xs leading-snug text-pretty">
          {{ error }}
        </p>
      </form>
      <DialogFooter>
        <Button variant="ghost" size="sm" @click="open = false">Annuler</Button>
        <Button type="submit" form="key-import" size="sm" :disabled="busy || !ready"
          >Importer</Button
        >
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
