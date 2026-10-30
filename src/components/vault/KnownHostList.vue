<script setup lang="ts">
import { Copy, ShieldCheck, Trash2 } from '@lucide/vue'
import { computed, ref } from 'vue'
import {
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
import { copyText } from '@/lib/clipboard'
import { useVault } from '@/stores/vault'
import { formatDate, truncateMiddle } from './format'
import IconAction from './IconAction.vue'
import { normalize } from './search'
import { useVaultActions } from './useVaultActions'
import VaultEmpty from './VaultEmpty.vue'
import VaultListPane from './VaultListPane.vue'
import VaultRow from './VaultRow.vue'

const vault = useVault()
const actions = useVaultActions()
const query = ref('')

const known = computed(() => {
  const words = normalize(query.value).split(/\s+/).filter(Boolean)
  return vault.view.knownHosts
    .filter((item) =>
      words.every((word) => normalize(`${item.address}:${item.port}`).includes(word)),
    )
    .sort((a, b) => a.address.localeCompare(b.address) || a.port - b.port)
})
const ids = computed(() => known.value.map((item) => item.id))
</script>

<template>
  <VaultListPane
    v-model:query="query"
    title="Empreintes connues"
    description="Les serveurs dont vous avez accepté l’empreinte à la première connexion. Via vérifie ensuite qu’elle ne change pas. Oubliez-en une si le serveur a été réinstallé."
    search-label="Rechercher un serveur"
    :ids="ids"
    @remove="actions.deleteKnownHost"
  >
    <template #default="{ tabbable, current }">
      <VaultRow
        v-for="item in known"
        :id="item.id"
        :key="item.id"
        :current="current(item.id)"
        :tabbable="tabbable(item.id)"
      >
        <ShieldCheck
          class="size-4 shrink-0 text-ink-muted"
          :stroke-width="1.5"
          aria-hidden="true"
        />
        <div class="min-w-0 flex-1">
          <div class="truncate font-medium">{{ item.address }}:{{ item.port }}</div>
          <div class="text-muted-foreground flex min-w-0 gap-2 text-xs">
            <span class="shrink-0">{{ item.algorithm }}</span>
            <span class="truncate font-mono select-text" :title="item.fingerprint">
              {{ truncateMiddle(item.fingerprint, 36) }}
            </span>
          </div>
        </div>
        <span
          class="text-muted-foreground shrink-0 text-xs group-hover/row:hidden group-focus-visible/row:hidden group-data-[state=open]/row:hidden"
          >Ajoutée le {{ formatDate(item.addedAt) }}</span
        >
        <template #actions>
          <IconAction
            label="Oublier cette empreinte"
            tabindex="-1"
            @click.stop="actions.deleteKnownHost(item.id)"
          >
            <Trash2 :stroke-width="1.5" />
          </IconAction>
        </template>
        <template #menu>
          <ContextMenuItem @select="copyText(item.fingerprint, 'Empreinte copiée')">
            <Copy :stroke-width="1.5" /> Copier l’empreinte
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem variant="destructive" @select="actions.deleteKnownHost(item.id)">
            <Trash2 :stroke-width="1.5" /> Oublier l’empreinte
            <ContextMenuShortcut>Suppr</ContextMenuShortcut>
          </ContextMenuItem>
        </template>
      </VaultRow>
    </template>
    <template #empty>
      <VaultEmpty
        :title="
          query.trim()
            ? `Aucun serveur ne correspond à « ${query.trim()} »`
            : 'Aucune empreinte connue'
        "
        description="Quand vous faites confiance à un serveur lors d’une première connexion, son empreinte apparaît ici. Via vérifie ensuite qu’elle ne change pas."
      />
    </template>
  </VaultListPane>
</template>
