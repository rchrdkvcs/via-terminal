<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MoreHorizontal, Pencil, Trash2, X } from '@lucide/vue'
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
import type { DropZone, SidebarDrag } from '@/lib/sidebar-dnd'
import {
  acceptDrop,
  activeDrag,
  dropHint,
  dropZoneClass,
  endSidebarDrag,
  readSidebarDrag,
  rowZone,
  startSidebarDrag,
} from '@/lib/sidebar-dnd'

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

function closeUnique(node: TreeNode) {
  const tab = store.uniqueTabForTarget(node.targetId)
  if (tab) void store.closeTab(tab.id)
}

function rowState(node: TreeNode) {
  const statuses = node.sessionIds.map((id) => store.sessionById.get(id)?.status)
  if (!statuses.length) return 'idle'
  if (statuses.includes('failed') || statuses.includes('disconnected')) return 'offline'
  if (statuses.includes('reconnecting') || statuses.includes('connecting')) return 'pending'
  if (statuses.every((status) => status === 'restorable' || status === 'closed')) return 'idle'
  return 'online'
}

function beginRename(node: TreeNode) {
  editing.value = node.id
  draft.value = node.label
}

watch(
  () => store.renamingNodeId,
  (id) => {
    const node = props.nodes.find((item) => item.id === id)
    if (!node) return
    beginRename(node)
    store.renamingNodeId = null
  },
)

function commitRename(node: TreeNode) {
  const value = draft.value
  editing.value = null
  if (value.trim() && value !== node.label) void store.renameNode(node.id, value)
}

function startDrag(event: DragEvent, node: TreeNode) {
  startSidebarDrag(
    event,
    props.pinned
      ? { type: 'favorite', id: node.id, targetId: node.targetId! }
      : { type: 'node', id: node.id },
  )
}

/** A folder cannot be dropped inside one of its own descendants. */
function contains(ancestorId: string, nodeId: string) {
  let current = store.sidebarNodes.find((item) => item.id === nodeId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) return true
    current = store.sidebarNodes.find((item) => item.id === current!.parentId)
  }
  return false
}

function allows(drag: SidebarDrag, node: TreeNode, zone: DropZone) {
  // Only an SSH resource can be pinned; a folder has no target.
  if (props.pinned && drag.type === 'node')
    return Boolean(store.sidebarNodes.find((item) => item.id === drag.id)?.targetId)
  if (drag.type !== 'node') return true
  if (drag.id === node.id) return false
  return zone !== 'into' || !contains(drag.id, node.id)
}

/** The row after this one, which the dragged row must precede on an `after`. */
function nextId(node: TreeNode) {
  const index = props.nodes.findIndex((item) => item.id === node.id)
  return props.nodes[index + 1]?.id ?? null
}

function hintClass(node: TreeNode) {
  const [id, zone] = (dropHint.value ?? '').split(':')
  return id === node.id ? dropZoneClass[zone as DropZone] : ''
}

function zoneFor(event: DragEvent, node: TreeNode) {
  return rowZone(event, !props.pinned && node.kind === 'folder')
}

function onDragOver(event: DragEvent, node: TreeNode) {
  const drag = activeDrag.value
  if (!drag) return
  const zone = zoneFor(event, node)
  if (!allows(drag, node, zone)) return
  event.stopPropagation()
  acceptDrop(event)
  dropHint.value = `${node.id}:${zone}`
}

function onDrop(event: DragEvent, node: TreeNode) {
  const drag = readSidebarDrag(event)
  const zone = zoneFor(event, node)
  // A refused drop keeps bubbling, so the group below appends it instead.
  if (!drag || !allows(drag, node, zone)) return
  event.stopPropagation()
  event.preventDefault()
  endSidebarDrag()
  if (props.pinned) {
    pin(drag, zone === 'after' ? nextId(node) : node.id)
    return
  }
  if (zone === 'into') place(drag, node.id, null)
  else place(drag, props.parentId, zone === 'before' ? node.id : nextId(node))
}

function place(drag: SidebarDrag, parentId: string | null, beforeId: string | null) {
  if (drag.type === 'node') void store.reparentNode(drag.id, parentId, beforeId)
  else if (drag.type === 'tab') void store.placeTab(drag.id, parentId, beforeId)
  else void store.placeTarget(drag.targetId, parentId, beforeId)
}

function pin(drag: SidebarDrag, beforeId: string | null) {
  if (drag.type === 'tab') {
    void store.pinTab(drag.id, beforeId)
    return
  }
  const targetId =
    drag.type === 'favorite'
      ? drag.targetId
      : store.sidebarNodes.find((item) => item.id === drag.id)?.targetId
  if (targetId) void store.pinTarget(targetId, beforeId)
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem
      v-for="node in nodes"
      :key="node.id"
      draggable="true"
      class="transition-opacity"
      :class="activeDrag?.id === node.id ? 'opacity-40' : ''"
      @dragstart.stop="startDrag($event, node)"
      @dragend.stop="endSidebarDrag()"
    >
      <SidebarMenuButton
        :is-active="store.isTargetActive(node.targetId)"
        :role="node.kind === 'folder' ? undefined : 'tab'"
        :aria-selected="node.kind === 'folder' ? undefined : store.isTargetActive(node.targetId)"
        :aria-expanded="node.kind === 'folder' ? !collapsed.has(node.id) : undefined"
        :style="{ paddingInlineStart: `${8 + node.depth * 12}px` }"
        :class="hintClass(node)"
        @click="activate(node, $event)"
        @auxclick.middle.prevent="closeUnique(node)"
        @keydown.alt.up.prevent="store.moveNode(node.id, -1)"
        @keydown.alt.down.prevent="store.moveNode(node.id, 1)"
        @dragenter="onDragOver($event, node)"
        @dragover="onDragOver($event, node)"
        @drop="onDrop($event, node)"
      >
        <span class="relative flex shrink-0 items-center">
          <component
            :is="nodeIcon(node.kind, node.kind === 'folder' && !collapsed.has(node.id))"
            :stroke-width="1.5"
            :class="node.kind === 'folder' ? '' : 'text-sidebar-foreground/60'"
          />
          <span
            v-if="node.kind !== 'folder'"
            class="absolute -end-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-sidebar"
            :class="{
              'bg-state-online': rowState(node) === 'online',
              'bg-state-offline': rowState(node) === 'offline',
              'bg-state-pending': rowState(node) === 'pending',
              'bg-muted-foreground': rowState(node) === 'idle',
            }"
            aria-hidden="true"
          />
        </span>

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

      <SidebarMenuAction
        v-if="node.kind !== 'folder' && store.uniqueTabForTarget(node.targetId)"
        show-on-hover
        class="right-7"
        :aria-label="`Fermer ${node.label}`"
        @click.stop="closeUnique(node)"
      >
        <X :stroke-width="1.5" />
      </SidebarMenuAction>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuAction show-on-hover :aria-label="`Options de ${node.label}`">
            <MoreHorizontal :stroke-width="1.5" />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="right" class="w-52">
          <DropdownMenuItem @select="beginRename(node)">
            <Pencil :stroke-width="1.5" />
            Renommer
          </DropdownMenuItem>
          <DropdownMenuItem
            v-if="node.kind !== 'folder' && store.uniqueTabForTarget(node.targetId)"
            @select="closeUnique(node)"
          >
            <X :stroke-width="1.5" />
            Fermer
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" @select="store.deleteNode(node.id)">
            <Trash2 :stroke-width="1.5" />
            Supprimer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <SidebarTree
        v-if="node.children.length && !collapsed.has(node.id)"
        :nodes="node.children"
        :parent-id="node.id"
      />
    </SidebarMenuItem>
  </SidebarMenu>
</template>
