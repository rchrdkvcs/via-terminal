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
import { Label } from '@/components/ui/label'
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

const props = defineProps<{ mode: 'profile' | 'resource' | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useAppStore()

const open = computed({
  get: () => props.mode !== null,
  set: (value: boolean) => {
    if (!value) emit('close')
  },
})

const name = ref('')
const executable = ref('')
const workingDirectory = ref('')
const host = ref('')
const sshAlias = ref('')
const port = ref('')
const username = ref('')
const identityFile = ref('')
const sshTargets = ref<SshTarget[]>([])

const canSubmit = computed(() =>
  props.mode === 'profile'
    ? name.value.trim().length > 0 && executable.value.trim().length > 0
    : name.value.trim().length > 0 &&
      username.value.trim().length > 0 &&
      (host.value.trim().length > 0 || sshAlias.value.trim().length > 0),
)

watch(
  () => props.mode,
  async (mode) => {
    name.value = ''
    executable.value = store.detectedShells[0] ?? ''
    workingDirectory.value = ''
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
  if (props.mode === 'profile') {
    await store.createLocalProfile({
      name: name.value,
      executable: executable.value,
      args: [],
      workingDirectory: workingDirectory.value.trim() || null,
      parentId: null,
    })
  } else {
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
  }
  emit('close')
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{ mode === 'profile' ? 'Nouveau profil local' : 'Nouvelle ressource SSH' }}
        </DialogTitle>
        <DialogDescription>
          {{
            mode === 'profile'
              ? 'Une recette pour lancer un shell local dans cet espace de travail.'
              : 'Terminarr lit votre configuration OpenSSH, il ne la modifie jamais.'
          }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="submit">
        <div class="space-y-2">
          <Label for="target-name">Nom</Label>
          <Input id="target-name" v-model="name" autofocus placeholder="PowerShell" />
        </div>

        <template v-if="mode === 'profile'">
          <div class="space-y-2">
            <Label for="target-exe">Exécutable</Label>
            <Select v-if="store.detectedShells.length" v-model="executable">
              <SelectTrigger id="target-exe"><SelectValue placeholder="Choisir" /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="shell in store.detectedShells" :key="shell" :value="shell">
                  {{ shell }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input v-else id="target-exe" v-model="executable" placeholder="powershell.exe" />
            <p v-if="!store.detectedShells.length" class="text-xs text-muted-foreground">
              Aucun shell détecté automatiquement ; saisissez le chemin de l’exécutable.
            </p>
          </div>

          <div class="space-y-2">
            <Label for="target-cwd">Dossier de départ</Label>
            <Input id="target-cwd" v-model="workingDirectory" placeholder="Facultatif" />
          </div>
        </template>

        <template v-else>
          <div v-if="sshTargets.length" class="space-y-2">
            <Label for="target-alias">Alias de votre configuration SSH</Label>
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
          </div>

          <div class="grid grid-cols-[1fr_5rem] gap-3">
            <div class="space-y-2">
              <Label for="target-host">Hôte</Label>
              <Input
                id="target-host"
                v-model="host"
                placeholder="srv-01.exemple.net"
                :disabled="Boolean(sshAlias)"
              />
            </div>
            <div class="space-y-2">
              <Label for="target-port">Port</Label>
              <Input id="target-port" v-model="port" inputmode="numeric" placeholder="22" />
            </div>
          </div>

          <div class="space-y-2">
            <Label for="target-user">Utilisateur</Label>
            <Input id="target-user" v-model="username" placeholder="admin" />
          </div>

          <div class="space-y-2">
            <Label for="target-key">Fichier de clé</Label>
            <Input id="target-key" v-model="identityFile" placeholder="Facultatif" />
            <p class="text-xs text-muted-foreground">
              Les phrases de passe et l’agent restent gérés par OpenSSH.
            </p>
          </div>
        </template>

        <DialogFooter>
          <Button type="button" variant="ghost" @click="emit('close')">Annuler</Button>
          <Button type="submit" :disabled="!canSubmit" class="active:scale-[0.96]">Ajouter</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
