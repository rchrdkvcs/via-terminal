<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { MoreHorizontal, Pencil, Star, StarOff, Trash2 } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { nodeIcon } from '@/lib/icons'
import type { TreeNode } from '@/stores/app'
import { useAppStore } from '@/stores/app'

defineOptions({ name: 'SidebarTree' })

const props = withDefaults(defineProps<{ nodes: TreeNode[]; pinned?: boolean }>(), {
  pinned: false,
})

const store = useAppStore()
const editing = ref<string | null>(null)
const draft = ref('')
const input = ref<InstanceType<typeof Input> | null>(null)
const dragging = ref<string | null>(null)
const dropTarget = ref<{ id: string; mode: 'before' | 'inside' | 'after' } | null>(null)
const pendingDelete = ref<TreeNode | null>(null)

const collapsed = computed(() => ({ has: (id: string) => store.isFolderCollapsed(id) }))

function activate(node: TreeNode, event: MouseEvent) {
  if (node.kind === 'folder') {
    store.toggleFolder(node.id)
    return
  }
  if (!node.targetId) return
  // Ctrl or Shift click opens a second session instead of focusing the first.
  void store.openTarget(node.kind, node.targetId, { reuse: !(event.ctrlKey || event.shiftKey) })
}

async function beginRename(node: TreeNode) {
  editing.value = node.id
  draft.value = node.label
  store.renamingNodeId = null
  await nextTick()
  const element = input.value?.$el as HTMLInputElement | undefined
  element?.focus()
  element?.select()
}

function commitRename(node: TreeNode) {
  const value = draft.value
  editing.value = null
  if (value.trim() && value !== node.label) void store.renameNode(node.id, value)
}

watch(
  () => store.renamingNodeId,
  (id) => {
    if (!id) return
    const node = props.nodes.find((item) => item.id === id)
    if (node) void beginRename(node)
  },
  { immediate: true },
)

function onDragOver(event: DragEvent, node: TreeNode) {
  event.preventDefault()
  const row = event.currentTarget as HTMLElement
  const ratio = event.offsetY / Math.max(row.clientHeight, 1)
  const mode =
    node.kind === 'folder' && ratio > 0.25 && ratio < 0.75
      ? 'inside'
      : ratio < 0.5
        ? 'before'
        : 'after'
  dropTarget.value = { id: node.id, mode }
}

function onDragStart(event: DragEvent, id: string) {
  dragging.value = id
  event.dataTransfer?.setData('application/x-terminarr-sidebar-node', id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  dragging.value = null
  dropTarget.value = null
}

async function onDrop(event: DragEvent, node: TreeNode) {
  const sourceId =
    event.dataTransfer?.getData('application/x-terminarr-sidebar-node') || dragging.value
  const target = dropTarget.value
  dragging.value = null
  dropTarget.value = null
  if (!sourceId || !target) return
  const record = store.sidebarNodes.find((item) => item.id === node.id)
  if (!record) return
  if (target.mode === 'inside' && node.kind === 'folder') {
    store.setFolderCollapsed(node.id, false)
    await store.reparentNode(sourceId, node.id, node.children.length)
    return
  }
  await store.reparentNode(
    sourceId,
    record.parentId,
    Math.max(0, record.position + (target.mode === 'after' ? 1 : 0)),
  )
}

function requestDelete(node: TreeNode) {
  if (node.children.length || node.sessionIds.length) pendingDelete.value = node
  else void store.deleteNode(node.id)
}

async function confirmDelete() {
  const node = pendingDelete.value
  pendingDelete.value = null
  if (node) await store.deleteNode(node.id)
}
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem v-for="node in nodes" :key="node.id">
      <SidebarMenuButton
        :as="editing === node.id ? 'div' : 'button'"
        :is-active="
          Boolean(store.activePaneSessionId && node.sessionIds.includes(store.activePaneSessionId))
        "
        :aria-expanded="node.kind === 'folder' ? !collapsed.has(node.id) : undefined"
        :style="{ paddingInlineStart: `${8 + node.depth * 12}px` }"
        @click="activate(node, $event)"
        @keydown.alt.up.prevent="store.moveNode(node.id, -1)"
        @keydown.alt.down.prevent="store.moveNode(node.id, 1)"
        draggable="true"
        :class="{
          'opacity-40': dragging === node.id,
          'ring-1 ring-sidebar-ring': dropTarget?.id === node.id && dropTarget.mode === 'inside',
          'border-t border-sidebar-ring':
            dropTarget?.id === node.id && dropTarget.mode === 'before',
          'border-b border-sidebar-ring': dropTarget?.id === node.id && dropTarget.mode === 'after',
        }"
        @dragstart="onDragStart($event, node.id)"
        @dragend="onDragEnd"
        @dragover="onDragOver($event, node)"
        @drop.prevent="onDrop($event, node)"
      >
        <component
          :is="nodeIcon(node.kind, node.kind === 'folder' && !collapsed.has(node.id))"
          :stroke-width="1.5"
          :class="node.kind === 'folder' ? '' : 'text-sidebar-foreground/60'"
        />

        <Input
          v-if="editing === node.id"
          ref="input"
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
            <component :is="store.isFavorite(node.targetId) ? StarOff : Star" :stroke-width="1.5" />
            {{ store.isFavorite(node.targetId) ? 'Retirer des favoris' : 'Épingler en haut' }}
          </DropdownMenuItem>
          <template v-if="!pinned">
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" @select="requestDelete(node)">
              <Trash2 :stroke-width="1.5" />
              Supprimer
            </DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>

      <SidebarTree
        v-if="node.children.length && !collapsed.has(node.id)"
        :nodes="node.children"
        :pinned="pinned"
      />
    </SidebarMenuItem>
  </SidebarMenu>

  <Dialog :open="Boolean(pendingDelete)" @update:open="!$event && (pendingDelete = null)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Supprimer « {{ pendingDelete?.label }} » ?</DialogTitle>
        <DialogDescription>
          Les éléments enregistrés dans ce dossier seront supprimés. Les terminaux actifs concernés
          seront fermés par la suppression en cascade.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" @click="pendingDelete = null">Annuler</Button>
        <Button variant="destructive" @click="confirmDelete">Supprimer</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
