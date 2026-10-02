<script setup lang="ts">
import { KeyRound, LockKeyhole, Server } from '@lucide/vue'
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import type { Host } from '@/ipc/types'
import { useHostName } from '@/composables/useHostName'
import { useVault } from '@/stores/vault'
import VaultRow from './VaultRow.vue'

/** A host in the list: name, where it connects, tags and how it authenticates. */
const props = defineProps<{ host: Host; selected: boolean; tabbable: boolean }>()
defineEmits<{ select: []; connect: [] }>()
const vault = useVault()
const hostName = useHostName()

const credential = computed(() => {
  const effective = vault.view.effective[props.host.id]
  if (effective?.keyId) return { icon: KeyRound, label: 'Clé' }
  const identityId = effective?.identityId?.value
  if (vault.hasPassword(props.host.id) || (identityId && vault.hasPassword(identityId))) {
    return { icon: LockKeyhole, label: 'Mot de passe enregistré' }
  }
  return null
})
const shownTags = computed(() => props.host.tags.slice(0, 3))
</script>

<template>
  <VaultRow
    :id="host.id"
    :selected="selected"
    :tabbable="tabbable"
    @select="$emit('select')"
    @activate="$emit('connect')"
  >
    <span
      class="material-control grid size-8 shrink-0 place-items-center rounded-lg text-ink-muted"
    >
      <Server :size="15" :stroke-width="1.5" />
    </span>
    <div class="min-w-0 flex-1">
      <div
        class="truncate font-medium"
        :class="selected ? 'text-foreground' : 'text-foreground/90'"
      >
        {{ hostName(host.id) }}
      </div>
      <div class="text-muted-foreground truncate text-xs">{{ vault.describe(host.id) }}</div>
    </div>
    <div
      class="flex shrink-0 items-center gap-1 group-hover/row:hidden"
      :class="{ hidden: selected }"
    >
      <span
        v-for="tag in shownTags"
        :key="tag"
        class="rounded-[5px] px-1.5 py-px text-[11px] leading-4 text-ink-muted shadow-[0_0_0_1px_var(--hairline)]"
      >
        {{ tag }}
      </span>
      <span v-if="host.tags.length > shownTags.length" class="text-muted-foreground text-[11px]">
        +{{ host.tags.length - shownTags.length }}
      </span>
    </div>
    <component
      :is="credential.icon"
      v-if="credential"
      class="text-muted-foreground size-3.5 shrink-0"
      :stroke-width="1.5"
      :aria-label="credential.label"
      role="img"
    />
    <template #actions>
      <Button size="sm" variant="secondary" tabindex="-1" @click.stop="$emit('connect')"
        >Connecter</Button
      >
    </template>
  </VaultRow>
</template>
