<script setup lang="ts">
import { FolderPlus, Layers } from '@lucide/vue'
import { useVault } from '@/stores/vault'
import GroupTreeItem from './GroupTreeItem.vue'
import IconAction from './IconAction.vue'
import { useGroupTree } from './useGroupTree'
import { useVaultOptions } from './useVaultOptions'
import { useVaultState } from './useVaultState'

const vault = useVault()
const state = useVaultState()
const tree = useGroupTree()
const options = useVaultOptions()
</script>

<template>
  <section aria-labelledby="vault-groups-title" class="grid gap-0.5">
    <div class="flex h-7 items-center ps-2.5 pe-1">
      <h3 id="vault-groups-title" class="text-muted-foreground flex-1 text-xs">Groupes</h3>
      <IconAction label="Nouveau groupe" @click="tree.add(null)">
        <FolderPlus :stroke-width="1.5" />
      </IconAction>
    </div>
    <button
      type="button"
      class="focus-visible:ring-ring flex h-8 items-center gap-2 rounded-md px-2.5 text-start text-[13px] outline-none focus-visible:ring-2"
      :class="
        state.scope.value === null ? 'bg-row-selected shadow-row font-medium' : 'hover:bg-row-hover'
      "
      :aria-current="state.scope.value === null ? 'true' : undefined"
      @click="tree.choose(null)"
    >
      <Layers
        class="text-muted-foreground size-3.5 shrink-0"
        :stroke-width="1.5"
        aria-hidden="true"
      />
      <span class="flex-1 truncate">Tous les hôtes</span>
      <span class="text-muted-foreground text-xs font-normal tabular-nums">{{
        vault.view.hosts.length
      }}</span>
    </button>
    <ul v-if="options.tree.value.length" class="grid gap-0.5" aria-label="Groupes">
      <GroupTreeItem v-for="node in options.tree.value" :key="node.group.id" :node="node" />
    </ul>
    <p v-else class="text-muted-foreground px-2.5 py-1.5 text-xs leading-snug text-pretty">
      Rangez vos hôtes en groupes pour partager un utilisateur, un port ou une identité.
    </p>
  </section>
</template>
