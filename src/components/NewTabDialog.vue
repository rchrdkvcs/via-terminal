<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { tabTypes } from '@/domain/tab-types'
import { tabPanels } from '@/components/new-tab/panels'
import type { NewTabTarget, SshConfigurationRequest } from '@/components/new-tab/types'
import { describeError } from '@/ipc/client'
import { useAppStore } from '@/stores/app'

const emit = defineEmits<{ configure: [request: SshConfigurationRequest] }>()
const store = useAppStore()
const busy = ref(false)
const error = ref('')
const open = computed({
  get: () => store.newTabOpen,
  set: (value: boolean) => {
    if (!busy.value) store.newTabOpen = value
  },
})
watch(
  () => store.newTabOpen,
  () => {
    error.value = ''
  },
)
watch(
  () => store.activeWorkspaceId,
  () => {
    store.newTabOpen = false
  },
)

async function openTab(target: NewTabTarget) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    const tab =
      target.kind === 'profile'
        ? await store.createTerminal(target.id)
        : await store.openTarget(target.kind, target.id, { reuse: false })
    if (tab) {
      store.newTabOpen = false
      store.route = 'workspace'
    }
  } catch (cause) {
    error.value = describeError(cause)
  } finally {
    busy.value = false
  }
}

function configure(request: SshConfigurationRequest) {
  if (busy.value) return
  store.newTabOpen = false
  emit('configure', request)
}

function remove(id: string) {
  if (busy.value) return
  // Let the existing deletion confirmation own focus instead of stacking dialogs.
  store.newTabOpen = false
  void store.requestNodeDelete(id)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="max-h-[85vh] overflow-y-auto sm:max-w-2xl"
      :show-close-button="!busy"
      @interact-outside="busy && $event.preventDefault()"
      @escape-key-down="busy && $event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>Nouvel onglet</DialogTitle>
        <DialogDescription
          >Choisissez le type de session pour
          {{ store.activeWorkspace?.name ?? 'cet espace' }}.</DialogDescription
        >
      </DialogHeader>
      <Tabs v-model="store.newTabType" :aria-busy="busy">
        <TabsList class="w-full" aria-label="Type de session">
          <TabsTrigger v-for="type in tabTypes" :key="type.id" :value="type.id" :disabled="busy">
            <component :is="tabPanels[type.id].icon" :size="16" :stroke-width="1.5" />
            {{ type.label }}
          </TabsTrigger>
        </TabsList>
        <TabsContent v-for="type in tabTypes" :key="type.id" :value="type.id" class="pt-3">
          <p class="mb-3 text-sm text-muted-foreground">{{ type.description }}</p>
          <component
            :is="tabPanels[type.id].panel"
            :busy="busy"
            @open="openTab"
            @configure="configure"
            @remove="remove"
          />
        </TabsContent>
      </Tabs>
      <p v-if="busy" role="status" class="text-sm text-muted-foreground">
        Ouverture de la session…
      </p>
      <p v-if="error" role="alert" class="text-sm text-destructive">{{ error }}</p>
    </DialogContent>
  </Dialog>
</template>
