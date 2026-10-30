<script setup lang="ts">
import { FolderPlus } from '@lucide/vue'
import GroupTreeItem from './GroupTreeItem.vue'
import IconAction from './IconAction.vue'
import { useGroupTree } from './useGroupTree'
import { useVaultOptions } from './useVaultOptions'

const tree = useGroupTree()
const options = useVaultOptions()
</script>

<template>
  <section aria-labelledby="vault-groups-title" class="grid gap-0.5">
    <div class="flex h-7 items-center ps-2.5 pe-1">
      <h3 id="vault-groups-title" class="flex-1 text-xs font-medium text-ink-faint">Groupes</h3>
      <IconAction label="Nouveau groupe" @click="tree.add(null)">
        <FolderPlus :stroke-width="1.5" />
      </IconAction>
    </div>
    <ul v-if="options.tree.value.length" class="grid gap-0.5" aria-label="Groupes">
      <GroupTreeItem v-for="node in options.tree.value" :key="node.group.id" :node="node" />
    </ul>
    <p v-else class="px-2.5 py-1 text-xs leading-snug text-pretty text-ink-faint">
      Rangez vos hôtes en groupes pour partager un utilisateur, un port ou une identité.
    </p>
  </section>
</template>
