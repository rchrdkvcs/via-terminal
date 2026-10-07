<script setup lang="ts">
import { ChevronRight, Folder } from '@lucide/vue'
import { computed } from 'vue'
import GroupMenu from './GroupMenu.vue'
import InlineRename from './InlineRename.vue'
import type { TreeNode } from './tree'
import { useGroupTree } from './useGroupTree'
import { useVaultState } from './useVaultState'

const props = defineProps<{ node: TreeNode }>()
const state = useVaultState()
const tree = useGroupTree()

const id = computed(() => props.node.group.id)
const open = computed(() => !state.collapsed.has(id.value))
const current = computed(() => state.scope.value === id.value)

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'F2') state.renaming.value = id.value
  else if (event.key === 'Delete') tree.remove(id.value)
  else if (event.key === 'ArrowRight' && !open.value) tree.toggle(id.value)
  else if (event.key === 'ArrowLeft' && open.value && props.node.children.length)
    tree.toggle(id.value)
  else return
  event.preventDefault()
}
</script>

<template>
  <li>
    <div
      class="group/item flex h-8 items-center gap-0.5 rounded-md pe-1 text-[13px]"
      :class="current ? 'bg-row-selected shadow-row' : 'hover:bg-row-hover'"
      :style="{ paddingInlineStart: `${node.depth * 0.875}rem` }"
    >
      <button
        v-if="node.children.length"
        type="button"
        class="text-muted-foreground hover:text-foreground focus-visible:ring-ring grid size-6 shrink-0 place-items-center rounded-[5px] outline-none focus-visible:ring-2"
        :aria-label="open ? `Replier ${node.group.name}` : `Déplier ${node.group.name}`"
        :aria-expanded="open"
        @click="tree.toggle(id)"
      >
        <ChevronRight
          class="size-3.5 transition-transform duration-150 motion-reduce:transition-none"
          :class="{ 'rotate-90': open }"
          :stroke-width="1.5"
        />
      </button>
      <span v-else class="size-6 shrink-0" aria-hidden="true" />
      <InlineRename
        v-if="state.renaming.value === id"
        :value="node.group.name"
        label="Nom du groupe"
        @done="tree.rename(id, $event)"
      />
      <button
        v-else
        type="button"
        class="focus-visible:ring-ring flex h-7 min-w-0 flex-1 items-center gap-2 rounded-[5px] px-1 text-start outline-none focus-visible:ring-2"
        :aria-current="current ? 'true' : undefined"
        @click="tree.choose(id)"
        @dblclick="state.renaming.value = id"
        @keydown="onKeydown"
      >
        <Folder
          class="text-muted-foreground size-3.5 shrink-0"
          :stroke-width="1.5"
          aria-hidden="true"
        />
        <span class="truncate" :class="{ 'font-medium': current }">{{ node.group.name }}</span>
        <span class="text-muted-foreground ms-auto text-xs tabular-nums">{{ node.count }}</span>
      </button>
      <GroupMenu :group-id="id" :name="node.group.name" />
    </div>
    <ul v-if="open && node.children.length" role="group" class="mt-0.5 grid gap-0.5">
      <GroupTreeItem v-for="child in node.children" :key="child.group.id" :node="child" />
    </ul>
  </li>
</template>
