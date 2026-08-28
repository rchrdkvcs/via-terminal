<script setup lang="ts">
import { ref } from 'vue'
import type { SidebarNode } from '../types'
import IconGlyph from './IconGlyph.vue'
defineOptions({ name: 'TreeNode' })
defineProps<{ node: SidebarNode; depth?: number }>()
const emit = defineEmits<{ open: [node: SidebarNode]; move: [id: string, direction: -1 | 1] }>()
const expanded = ref(true)
</script>
<template>
  <li>
    <button
      class="tree-row"
      :style="{ paddingInlineStart: `${10 + (depth ?? 0) * 14}px` }"
      @click="node.kind === 'folder' ? (expanded = !expanded) : emit('open', node)"
      @keydown.alt.up.prevent="emit('move', node.id, -1)"
      @keydown.alt.down.prevent="emit('move', node.id, 1)"
    >
      <IconGlyph
        v-if="node.kind === 'folder'"
        :name="expanded ? 'ChevronDown' : 'ChevronRight'"
        :size="13"
      />
      <IconGlyph :name="node.icon ?? (node.kind === 'folder' ? 'Folder' : 'Terminal')" />
      <span>{{ node.name }}</span
      ><span v-if="node.sessions?.length" class="session-count">{{ node.sessions.length }}</span>
      <i
        v-if="
          node.sessions?.some(
            (session) => session.status === 'failed' || session.status === 'disconnected',
          )
        "
        class="status-dot failed"
        title="Connexion interrompue"
      />
    </button>
    <ul v-if="expanded && node.children" class="tree-list">
      <TreeNode
        v-for="child in node.children"
        :key="child.id"
        :node="child"
        :depth="(depth ?? 0) + 1"
        @open="emit('open', $event)"
        @move="(id, direction) => emit('move', id, direction)"
      />
    </ul>
  </li>
</template>
