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
import { api, describeError, isNative } from '@/ipc/client'
import type { SshTarget } from '@/ipc/types'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  mode: 'resource' | null
  resourceId?: string | null
  duplicate?: boolean
}>()
const emit = defineEmits<{ close: [connect?: boolean] }>()

const store = useAppStore()

const open = computed({
  get: () => props.mode !== null,
  set: (value: boolean) => {
    if (!value && !pending.value) emit('close')
  },
})

const name = ref('')
const host = ref('')
const sshAlias = ref('')
const port = ref('')
const username = ref('')
const identityFile = ref('')
const sshTargets = ref<SshTarget[]>([])
const identityId = ref('new')
const identityName = ref('')
const pending = ref(false)
const error = ref('')
const editing = computed(() => Boolean(props.resourceId) && !props.duplicate)
const validPort = computed(
  () =>
    !port.value ||
    (/^\d+$/.test(port.value) && Number(port.value) >= 1 && Number(port.value) <= 65535),
)
const canSubmit = computed(
  () =>
    !pending.value &&
    name.value.trim().length > 0 &&
    validPort.value &&
    (identityId.value !== 'new' || username.value.trim().length > 0) &&
    (host.value.trim().length > 0 || sshAlias.value.trim().length > 0),
)

watch(
  () => [props.mode, props.resourceId, props.duplicate] as const,
  async ([mode]) => {
    const resource = store.workspaceResources.find((item) => item.id === props.resourceId)
    const identity = store.workspaceIdentities.find((item) => item.id === resource?.identityId)
    name.value = resource ? resource.name + (props.duplicate ? ' (copie)' : '') : ''
    host.value = resource?.host ?? ''
    sshAlias.value = resource?.sshAlias ?? ''
    port.value = String(resource?.port ?? '')
    identityId.value = identity?.id ?? 'new'
    identityName.value = ''
    username.value = ''
    identityFile.value = ''
    error.value = ''
    sshTargets.value = []
    if (mode === 'resource' && isNative()) {
      sshTargets.value = await api.listSshTargets().catch(() => [])
    }
  },
  { immediate: true },
)

watch(
  () => store.activeWorkspaceId,
  () => {
    if (open.value) emit('close', true)
  },
)

function copyIdentity() {
  const identity = store.workspaceIdentities.find((item) => item.id === identityId.value)
  if (!identity) return
  identityName.value = identity.name
  username.value = identity.username
  identityFile.value = identity.identityFile ?? ''
  identityId.value = 'new'
}

/** Picking an alias fills the fields OpenSSH already resolves for it. */
function useAlias(alias: string) {
  const target = sshTargets.value.find((item) => item.alias === alias)
  if (!target) return
  identityId.value = 'new'
  sshAlias.value = target.alias
  if (!name.value.trim()) name.value = target.alias
  if (target.user) username.value = target.user
  if (target.port) port.value = String(target.port)
  if (target.identityFile) identityFile.value = target.identityFile
}

async function submit(connect = false) {
  if (!canSubmit.value) return
  pending.value = true
  error.value = ''
  try {
    const resource = await store.saveSshResource({
      id: editing.value ? props.resourceId! : null,
      name: name.value,
      host: sshAlias.value.trim() ? null : host.value.trim() || null,
      sshAlias: sshAlias.value.trim() || null,
      port: port.value ? Number(port.value) : null,
      identityId: identityId.value === 'new' ? null : identityId.value,
      identityName: identityName.value,
      username: username.value,
      identityFile: identityFile.value.trim() || null,
      parentId: null,
    })
    emit('close', connect)
    if (connect) {
      store.route = 'workspace'
      await store.openTarget('resource', resource.id, { reuse: false })
    }
  } catch (cause) {
    error.value = describeError(cause)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-h-[90vh] overflow-y-auto sm:max-w-lg"
      :show-close-button="!pending"
      @interact-outside="pending && $event.preventDefault()"
      @escape-key-down="pending && $event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>{{
          editing ? 'Modifier la connexion SSH' : 'Nouvelle connexion SSH'
        }}</DialogTitle>
        <DialogDescription>
          Connexion enregistrée localement dans cet espace, sans compte ni synchronisation.
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="submit()">
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

        <Field>
          <FieldLabel for="target-ssh-alias">Alias OpenSSH</FieldLabel>
          <Input id="target-ssh-alias" v-model="sshAlias" placeholder="Facultatif" />
          <FieldDescription
            >Effacez l’alias pour utiliser une adresse directement.</FieldDescription
          >
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
            <Input
              id="target-port"
              v-model="port"
              inputmode="numeric"
              placeholder="22"
              :aria-invalid="!validPort"
              aria-describedby="target-port-error"
            />
          </Field>
        </div>

        <p v-if="!validPort" id="target-port-error" role="alert" class="text-sm text-destructive">
          Le port doit être un entier entre 1 et 65535.
        </p>

        <Field>
          <FieldLabel for="target-identity">Identité</FieldLabel>
          <Select v-model="identityId">
            <SelectTrigger id="target-identity"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">Nouvelle identité</SelectItem>
              <SelectItem
                v-for="identity in store.workspaceIdentities"
                :key="identity.id"
                :value="identity.id"
              >
                {{ identity.name }} — {{ identity.username }}
              </SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription v-if="identityId !== 'new'"
            >Identité réutilisée. Ses paramètres restent inchangés.</FieldDescription
          >
          <Button
            v-if="identityId !== 'new'"
            type="button"
            variant="ghost"
            size="sm"
            @click="copyIdentity"
            >Personnaliser pour cette connexion</Button
          >
        </Field>
        <Field v-if="identityId === 'new'">
          <FieldLabel for="target-identity-name">Nom de l’identité</FieldLabel>
          <Input
            id="target-identity-name"
            v-model="identityName"
            placeholder="Administrateur (facultatif)"
          />
        </Field>
        <Field v-if="identityId === 'new'">
          <FieldLabel for="target-user">Utilisateur</FieldLabel>
          <Input id="target-user" v-model="username" placeholder="admin" />
        </Field>

        <Field v-if="identityId === 'new'">
          <FieldLabel for="target-key">Fichier de clé</FieldLabel>
          <Input id="target-key" v-model="identityFile" placeholder="Facultatif" />
          <FieldDescription>
            Les phrases de passe et l’agent restent gérés par OpenSSH.
          </FieldDescription>
        </Field>

        <p class="text-xs text-muted-foreground">
          Sans fichier de clé, OpenSSH utilise votre agent et sa configuration ou demande le mot de
          passe dans le terminal.
        </p>
        <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
        <DialogFooter>
          <Button type="button" variant="ghost" :disabled="pending" @click="emit('close')"
            >Annuler</Button
          >
          <Button type="submit" :disabled="!canSubmit" class="active:scale-[0.96]">{{
            pending ? 'Enregistrement…' : 'Enregistrer'
          }}</Button>
          <Button type="button" :disabled="!canSubmit" @click="submit(true)"
            >Enregistrer et connecter</Button
          >
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
