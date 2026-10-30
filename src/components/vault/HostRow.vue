<script setup lang="ts">
import { Copy, CopyPlus, KeyRound, LockKeyhole, Pencil, Plug, Server, Trash2 } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
import { copyText } from '@/lib/clipboard'
import type { Host } from '@/ipc/types'
import { useHostName } from '@/composables/useHostName'
import { useVault } from '@/stores/vault'
import { useVaultActions } from './useVaultActions'
import VaultRow from './VaultRow.vue'

const props = defineProps<{ host: Host; current: boolean; tabbable: boolean }>()
defineEmits<{ open: [] }>()
const vault = useVault()
const hostName = useHostName()
const actions = useVaultActions()

const credential = computed(() => {
  const effective = vault.view.effective[props.host.id]
  if (effective?.keyId)
    return { icon: KeyRound, label: 'Clé', title: 'Se connecte avec une clé du coffre' }
  const identityId = effective?.identityId?.value
  if (vault.hasPassword(props.host.id) || (identityId && vault.hasPassword(identityId))) {
    return {
      icon: LockKeyhole,
      label: 'Mot de passe',
      title: 'Mot de passe enregistré dans le coffre',
    }
  }
  return null
})
const shownTags = computed(() => props.host.tags.slice(0, 3))
</script>

<template>
  <VaultRow :id="host.id" :current="current" :tabbable="tabbable" @open="$emit('open')">
    <span
      class="material-control grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted"
    >
      <Server :size="15" :stroke-width="1.5" />
    </span>
    <div class="min-w-0 flex-1">
      <div class="truncate font-medium">{{ hostName(host.id) }}</div>
      <div class="truncate text-xs text-ink-muted">{{ vault.describe(host.id) }}</div>
    </div>
    <div class="flex shrink-0 items-center gap-1">
      <span
        v-for="tag in shownTags"
        :key="tag"
        class="rounded-[5px] px-1.5 py-px text-[11px] leading-4 text-ink-muted shadow-[inset_0_0_0_1px_var(--hairline-strong)]"
      >
        {{ tag }}
      </span>
      <span v-if="host.tags.length > shownTags.length" class="text-[11px] text-ink-faint">
        +{{ host.tags.length - shownTags.length }}
      </span>
      <span
        v-if="credential"
        class="flex items-center gap-1 ps-1 text-[11px] text-ink-faint"
        :title="credential.title"
      >
        <component :is="credential.icon" class="size-3" :stroke-width="1.5" aria-hidden="true" />
        {{ credential.label }}
      </span>
    </div>
    <template #actions>
      <Button size="xs" tabindex="-1" @click.stop="actions.connect(host.id)">
        <Plug :stroke-width="1.5" />
        Connecter
      </Button>
    </template>
    <template #menu>
      <ContextMenuItem @select="actions.connect(host.id)">
        <Plug :stroke-width="1.5" /> Se connecter
        <ContextMenuShortcut>Entrée</ContextMenuShortcut>
      </ContextMenuItem>
      <ContextMenuItem @select="$emit('open')">
        <Pencil :stroke-width="1.5" /> Modifier
      </ContextMenuItem>
      <ContextMenuItem @select="actions.duplicateHost(host.id)">
        <CopyPlus :stroke-width="1.5" /> Dupliquer
      </ContextMenuItem>
      <ContextMenuItem @select="copyText(vault.describe(host.id), 'Adresse copiée')">
        <Copy :stroke-width="1.5" /> Copier l’adresse
      </ContextMenuItem>
      <ContextMenuSeparator />
      <ContextMenuItem variant="destructive" @select="actions.deleteHost(host.id)">
        <Trash2 :stroke-width="1.5" /> Supprimer
        <ContextMenuShortcut>Suppr</ContextMenuShortcut>
      </ContextMenuItem>
    </template>
  </VaultRow>
</template>
