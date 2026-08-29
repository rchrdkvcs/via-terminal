<script setup lang="ts">
import { computed, ref } from 'vue'
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
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { nodeIcon } from '@/lib/icons'
import type { TreeNode } from '@/stores/app'
import { useAppStore } from '@/stores/app'
import { readSidebarDrag, writeSidebarDrag } from '@/lib/sidebar-dnd'

defineOptions({ name: 'SidebarTree' })

const props = withDefaults(
  defineProps<{ nodes: TreeNode[]; pinned?: boolean; parentId?: string | null }>(),
  { pinned: false, parentId: null },
)

const store = useAppStore()
const collapsed = computed(() => ({ has: (id: string) => store.isFolderCollapsed(id) }))
const editing = ref<string | null>(null)
const draft = ref('')

function toggle(id: string) {
  store.setFolderCollapsed(id, !store.isFolderCollapsed(id))
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

function startDrag(event: DragEvent, node: TreeNode) {
  writeSidebarDrag(
    event,
    props.pinned ? { type: 'favorite', targetId: node.targetId! } : { type: 'node', id: node.id },
  )
}

function targetIdOf(drag: ReturnType<typeof readSidebarDrag>) {
  if (!drag) return null
  if (drag.type === 'favorite') return drag.targetId
  if (drag.type === 'node') return store.sidebarNodes.find((node) => node.id === drag.id)?.targetId
  const tab = store.tabs.find((item) => item.id === drag.id)
  const sessionId = tab && store.paneSessionIds(tab.root)[0]
  return sessionId ? store.sessionById.get(sessionId)?.targetId : null
}

function dropAt(event: DragEvent, position: number) {
  const drag = readSidebarDrag(event)
  if (!drag) return
  if (props.pinned) {
    const targetId = targetIdOf(drag)
    if (targetId) void store.pinTarget(targetId, position)
  } else if (drag.type === 'node') {
    const record = store.sidebarNodes.find((node) => node.id === drag.id)
    if (record?.parentId === props.parentId) {
      const source = props.nodes.findIndex((node) => node.id === drag.id)
      if (source >= 0 && source < position) position -= 1
    }
    void store.reparentNode(drag.id, props.parentId, position)
  } else if (drag.type === 'tab') void store.placeTab(drag.id, props.parentId, position)
  else void store.placeTarget(drag.targetId, props.parentId, position)
}

function dropInto(event: DragEvent, folderId: string) {
  const drag = readSidebarDrag(event)
  if (!drag) return
  const position = store.sidebarNodes.filter((node) => node.parentId === folderId).length
  if (drag.type === 'node') void store.reparentNode(drag.id, folderId, position)
  else if (drag.type === 'tab') void store.placeTab(drag.id, folderId, position)
  else void store.placeTarget(drag.targetId, folderId, position)
}
</script>

<template>
  <SidebarMenu>
    <template v-for="(node, index) in nodes" :key="node.id">
      <li
        class="h-2 rounded transition-colors"
        aria-hidden="true"
        @dragover.prevent
        @drop.stop.prevent="dropAt($event, index)"
      />
      <SidebarMenuItem
        draggable="true"
        class="rounded transition-opacity"
        @dragstart="startDrag($event, node)"
        @dragend="($event.currentTarget as HTMLElement).classList.remove('opacity-50')"
      >
        <SidebarMenuButton
          :is-active="Boolean(node.targetId) && node.sessionIds.length > 0"
          :aria-expanded="node.kind === 'folder' ? !collapsed.has(node.id) : undefined"
          :style="{ paddingInlineStart: `${8 + node.depth * 12}px` }"
          @click="activate(node, $event)"
          @keydown.alt.up.prevent="store.moveNode(node.id, -1)"
          @keydown.alt.down.prevent="store.moveNode(node.id, 1)"
          @dragover="node.kind === 'folder' && $event.preventDefault()"
          @drop.stop.prevent="node.kind === 'folder' && dropInto($event, node.id)"
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
          <span v-else class="truncate" @dblclick.stop="beginRename(node)">{{ node.label }}</span>
        </SidebarMenuButton>

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
              <component
                :is="store.isFavorite(node.targetId) ? StarOff : Star"
                :stroke-width="1.5"
              />
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

        <SidebarTree
          v-if="node.children.length && !collapsed.has(node.id)"
          :nodes="node.children"
          :parent-id="node.id"
        />
      </SidebarMenuItem>
    </template>
    <li
      class="h-2 rounded transition-colors"
      aria-hidden="true"
      @dragover.prevent
      @drop.stop.prevent="dropAt($event, nodes.length)"
    />
  </SidebarMenu>
</template>
