<script setup lang="ts">
import { ref } from 'vue'
import {
  ChevronRight,
  Folder,
  HardDrive,
  MoreHorizontal,
  Pencil,
  Server,
  Star,
  Terminal,
  Trash2,
} from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import type { TreeNode } from '@/stores/app'
import { useAppStore } from '@/stores/app'

defineOptions({ name: 'SidebarTree' })

defineProps<{ nodes: TreeNode[] }>()

const store = useAppStore()
const collapsed = ref(new Set<string>())
const editing = ref<string | null>(null)
const draft = ref('')

function toggle(node: TreeNode) {
  const next = new Set(collapsed.value)
  if (next.has(node.id)) next.delete(node.id)
  else next.add(node.id)
  collapsed.value = next
}

function activate(node: TreeNode, event: MouseEvent) {
  if (node.kind === 'folder') {
    toggle(node)
    return
  }
  if (!node.targetId) return
  const targetKind = node.kind === 'resource' ? 'resource' : 'profile'
  // Ctrl/Shift-click opens a second session instead of focusing the first.
  void store.openTarget(targetKind, node.targetId, { reuse: !(event.ctrlKey || event.shiftKey) })
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

function iconFor(node: TreeNode) {
  if (node.kind === 'folder') return Folder
  if (node.kind === 'resource') return node.label.toLowerCase().includes('nas') ? HardDrive : Server
  return Terminal
}
</script>

<template>
  <ul class="space-y-px" role="group">
    <li v-for="node in nodes" :key="node.id">
      <div
        class="group/row relative flex items-center rounded-md transition-colors duration-150 hover:bg-sidebar-accent"
      >
        <button
          class="flex h-(--row-height) min-w-0 flex-1 items-center gap-2 rounded-md pe-1 text-[13px] text-sidebar-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          :style="{ paddingInlineStart: `${8 + node.depth * 14}px` }"
          :aria-expanded="node.kind === 'folder' ? !collapsed.has(node.id) : undefined"
          @click="activate(node, $event)"
          @keydown.alt.up.prevent="store.moveNode(node.id, -1)"
          @keydown.alt.down.prevent="store.moveNode(node.id, 1)"
        >
          <ChevronRight
            v-if="node.kind === 'folder'"
            :size="13"
            :stroke-width="1.5"
            class="shrink-0 transition-transform duration-150"
            :class="collapsed.has(node.id) ? '' : 'rotate-90'"
          />
          <component
            :is="iconFor(node)"
            :size="15"
            :stroke-width="1.5"
            class="shrink-0 text-muted-foreground"
          />

          <Input
            v-if="editing === node.id"
            v-model="draft"
            class="h-6 py-0 text-[13px]"
            autofocus
            @click.stop
            @keydown.enter="commitRename(node)"
            @keydown.esc="editing = null"
            @blur="commitRename(node)"
          />
          <span v-else class="truncate">{{ node.label }}</span>

          <span
            v-if="node.sessionIds.length"
            class="ms-auto shrink-0 rounded-full bg-success/15 px-1.5 text-[10px] font-medium tabular-nums text-success"
            :title="`${node.sessionIds.length} session(s) ouverte(s)`"
          >
            {{ node.sessionIds.length }}
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            class="me-1 grid size-6 shrink-0 place-items-center rounded-md text-muted-foreground opacity-0 transition-[opacity,background-color] duration-150 hover:bg-accent focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring group-hover/row:opacity-100 data-[state=open]:opacity-100"
            :aria-label="`Options de ${node.label}`"
          >
            <MoreHorizontal :size="14" :stroke-width="1.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-52">
            <DropdownMenuItem @select="beginRename(node)">
              <Pencil :size="14" :stroke-width="1.5" />
              Renommer
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="node.targetId"
              @select="
                store.toggleFavorite(
                  node.kind === 'resource' ? 'resource' : 'profile',
                  node.targetId!,
                )
              "
            >
              <Star :size="14" :stroke-width="1.5" />
              {{ store.isFavorite(node.targetId) ? 'Retirer des favoris' : 'Ajouter aux favoris' }}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" @select="store.deleteNode(node.id)">
              <Trash2 :size="14" :stroke-width="1.5" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <SidebarTree v-if="node.children.length && !collapsed.has(node.id)" :nodes="node.children" />
    </li>
  </ul>
</template>
