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
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, isNative } from '@/ipc/client'
import type { SshTarget } from '@/ipc/types'
import { useAppStore } from '@/stores/app'

const props = defineProps<{ mode: 'resource' | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useAppStore()

const open = computed({
  get: () => props.mode !== null,
  set: (value: boolean) => {
    if (!value) emit('close')
  },
})

const name = ref('')
const host = ref('')
const sshAlias = ref('')
const port = ref('')
const username = ref('')
const identityFile = ref('')
const sshTargets = ref<SshTarget[]>([])

const canSubmit = computed(
  () =>
    name.value.trim().length > 0 &&
    username.value.trim().length > 0 &&
    (host.value.trim().length > 0 || sshAlias.value.trim().length > 0),
)

watch(
  () => props.mode,
  async (mode) => {
    name.value = ''
    host.value = ''
    sshAlias.value = ''
    port.value = ''
    username.value = ''
    identityFile.value = ''
    if (mode === 'resource' && isNative()) {
      sshTargets.value = await api.listSshTargets().catch(() => [])
    }
  },
)

/** Picking an alias fills the fields OpenSSH already resolves for it. */
function useAlias(alias: string) {
  const target = sshTargets.value.find((item) => item.alias === alias)
  if (!target) return
  sshAlias.value = target.alias
  if (!name.value.trim()) name.value = target.alias
  if (target.user) username.value = target.user
  if (target.port) port.value = String(target.port)
  if (target.identityFile) identityFile.value = target.identityFile
}

async function submit() {
  if (!canSubmit.value) return
  await store.createSshResource({
    name: name.value,
    host: host.value.trim() || null,
    sshAlias: sshAlias.value.trim() || null,
    port: port.value ? Number(port.value) : null,
    identityName: username.value,
    username: username.value,
    identityFile: identityFile.value.trim() || null,
    parentId: null,
  })
  emit('close')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Nouvelle ressource SSH</DialogTitle>
        <DialogDescription>
          Via lit votre configuration OpenSSH, il ne la modifie jamais.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="submit">
        <Field>
          <FieldLabel for="target-name">Nom</FieldLabel>
          <Input id="target-name" v-model="name" autofocus placeholder="Production" />
        </Field>

        <Field v-if="sshTargets.length">
          <FieldLabel for="target-alias">Alias de votre configuration SSH</FieldLabel>
          <Select @update:model-value="useAlias(String($event))">
            <SelectTrigger id="target-alias">
              <SelectValue placeholder="Choisir un alias existant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="target in sshTargets" :key="target.alias" :value="target.alias">
                {{ target.alias }}
              </SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div class="grid grid-cols-[1fr_5rem] gap-3">
          <Field>
            <FieldLabel for="target-host">Hôte</FieldLabel>
            <Input
              id="target-host"
              v-model="host"
              placeholder="srv-01.exemple.net"
              :disabled="Boolean(sshAlias)"
            />
          </Field>
          <Field>
            <FieldLabel for="target-port">Port</FieldLabel>
            <Input id="target-port" v-model="port" inputmode="numeric" placeholder="22" />
          </Field>
        </div>

        <Field>
          <FieldLabel for="target-user">Utilisateur</FieldLabel>
          <Input id="target-user" v-model="username" placeholder="admin" />
        </Field>

        <Field>
          <FieldLabel for="target-key">Fichier de clé</FieldLabel>
          <Input id="target-key" v-model="identityFile" placeholder="Facultatif" />
          <FieldDescription>
            Les phrases de passe et l’agent restent gérés par OpenSSH.
          </FieldDescription>
        </Field>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="emit('close')">Annuler</Button>
          <Button type="submit" :disabled="!canSubmit" class="active:scale-[0.96]">Ajouter</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
