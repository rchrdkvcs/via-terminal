<script setup lang="ts">
import { ref } from 'vue'
import { MoreHorizontal, Pencil, Star, StarOff, Trash2 } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { nodeIcon } from '@/lib/icons'
import type { TreeNode } from '@/stores/app'
import { useAppStore } from '@/stores/app'

defineOptions({ name: 'SidebarTree' })

withDefaults(defineProps<{ nodes: TreeNode[]; pinned?: boolean }>(), { pinned: false })

const store = useAppStore()
const collapsed = ref(new Set<string>())
const editing = ref<string | null>(null)
const draft = ref('')

function toggle(id: string) {
  const next = new Set(collapsed.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  collapsed.value = next
}

function activate(node: TreeNode, event: MouseEvent) {
  if (node.kind === 'folder') {
    toggle(node.id)
    return
  }
  if (!node.targetId) return
  // Ctrl or Shift click opens a second session instead of focusing the first.
  void store.openTarget(node.kind, node.targetId, { reuse: !(event.ctrlKey || event.shiftKey) })
}

function beginRename(node: TreeNode) {
  editing.value = node.id
  draft.value = node.label
}

function commitRename(node: TreeNode) {
  const value = draft.value
  editing.value = null
  if (value.trim() && value !== node.label) void store.renameNode(node.id, value)
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem v-for="node in nodes" :key="node.id">
      <SidebarMenuButton
        :is-active="Boolean(node.targetId) && node.sessionIds.length > 0"
        :aria-expanded="node.kind === 'folder' ? !collapsed.has(node.id) : undefined"
        :style="{ paddingInlineStart: `${8 + node.depth * 12}px` }"
        @click="activate(node, $event)"
        @keydown.alt.up.prevent="store.moveNode(node.id, -1)"
        @keydown.alt.down.prevent="store.moveNode(node.id, 1)"
      >
        <component
          :is="nodeIcon(node.kind, node.kind === 'folder' && !collapsed.has(node.id))"
          :stroke-width="1.5"
          :class="node.kind === 'folder' ? '' : 'text-sidebar-foreground/60'"
        />

        <Input
          v-if="editing === node.id"
          v-model="draft"
          class="h-6 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0"
          autofocus
          @click.stop
          @keydown.enter="commitRename(node)"
          @keydown.esc="editing = null"
          @blur="commitRename(node)"
        />
        <span v-else>{{ node.label }}</span>
      </SidebarMenuButton>

      <SidebarMenuBadge v-if="node.sessionIds.length" class="peer-hover/menu-button:hidden">
        {{ node.sessionIds.length }}
      </SidebarMenuBadge>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuAction show-on-hover :aria-label="`Options de ${node.label}`">
            <MoreHorizontal :stroke-width="1.5" />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" class="w-52">
          <DropdownMenuItem v-if="!pinned" @select="beginRename(node)">
            <Pencil :stroke-width="1.5" />
            Renommer
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="node.targetId"
            @select="store.toggleFavorite(node.kind as 'profile' | 'resource', node.targetId!)"
          >
            <component :is="store.isFavorite(node.targetId) ? StarOff : Star" :stroke-width="1.5" />
            {{ store.isFavorite(node.targetId) ? 'Retirer des favoris' : 'Épingler en haut' }}
          </DropdownMenuItem>
          <template v-if="!pinned">
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" @select="store.deleteNode(node.id)">
              <Trash2 :stroke-width="1.5" />
              Supprimer
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>

      <SidebarTree v-if="node.children.length && !collapsed.has(node.id)" :nodes="node.children" />
    </SidebarMenuItem>
  </SidebarMenu>
</template>
