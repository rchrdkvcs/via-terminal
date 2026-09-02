<script setup lang="ts">
import { computed, nextTick, ref, watch, type ObjectDirective } from 'vue'
import { FolderPlus, Pencil, Trash2, X } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import InlineRenameInput from './InlineRenameInput.vue'
import { nodeIcon } from '@/lib/icons'
import type { TreeNode } from '@/stores/app'
import { useAppStore } from '@/stores/app'
import type { DropZone, SidebarDrag } from '@/lib/sidebar-dnd'
import {
  activeDrag,
  clearDropHint,
  dropHint,
  dropZoneClass,
  registerSidebarDrag,
  registerSidebarDrop,
  rowZone,
  setDropHint,
} from '@/lib/sidebar-dnd'
import TabRow from './TabRow.vue'
import DropRowIndicator from './DropRowIndicator.vue'

defineOptions({ name: 'SidebarTree' })

const props = withDefaults(
  defineProps<{
    nodes: TreeNode[]
    pinned?: boolean
    parentId?: string | null
    nextRootId?: string | null
  }>(),
  { pinned: false, parentId: null, nextRootId: null },
)

const store = useAppStore()
const collapsed = computed(() => ({ has: (id: string) => store.isFolderCollapsed(id) }))
const editing = ref<string | null>(null)
const draft = ref('')
const input = ref<InstanceType<typeof InlineRenameInput> | null>(null)
const menuFor = ref<string | null>(null)

function toggle(id: string) {
  store.setFolderCollapsed(id, !store.isFolderCollapsed(id))
}

function activate(node: TreeNode, event: MouseEvent) {
  if (node.tabId) {
    store.selectTab(node.tabId)
    return
  }
  if (node.kind === 'folder') {
    toggle(node.id)
    return
  }
  if (!node.targetId) return
  // Ctrl or Shift click opens a second session instead of focusing the first.
  void store.openTarget(node.kind, node.targetId, { reuse: !(event.ctrlKey || event.shiftKey) })
}

function openRowMenu(id: string) {
  menuFor.value = null
  void nextTick(() => {
    menuFor.value = id
  })
}

function closeUnique(node: TreeNode) {
  if (node.tabId) {
    void store.closeTab(node.tabId)
    return
  }
  const tab = store.uniqueTabForTarget(node.targetId)
  if (tab) void store.closeTab(tab.id)
}

function canClose(node: TreeNode) {
  if (node.kind === 'folder') return false
  return Boolean(node.tabId || store.uniqueTabForTarget(node.targetId))
}

function rowState(node: TreeNode) {
  const statuses = node.sessionIds.map((id) => store.sessionById.get(id)?.status)
  if (!statuses.length) return 'idle'
  if (statuses.includes('failed') || statuses.includes('disconnected')) return 'offline'
  if (statuses.includes('reconnecting') || statuses.includes('connecting')) return 'pending'
  if (statuses.every((status) => status === 'restorable' || status === 'closed')) return 'idle'
  return 'online'
}

function moveTabByKey(node: TreeNode, direction: -1 | 1) {
  if (!node.tabId) return
  const tabs = props.nodes.filter((item) => item.tabId)
  const index = tabs.findIndex((item) => item.tabId === node.tabId)
  const before = direction < 0 ? tabs[index - 1] : tabs[index + 2]
  if (direction < 0 && !before) return
  if (direction > 0 && index >= tabs.length - 1) return
  void store.reorderTabInFolder(node.tabId, before?.tabId ?? null)
}

function focusRenameInput() {
  const raw = input.value as unknown
  const inst = Array.isArray(raw) ? raw[0] : raw
  const element =
    (inst as { $el?: HTMLInputElement } | undefined)?.$el ?? (inst as HTMLInputElement | undefined)
  element?.focus?.()
  element?.select?.()
}

async function beginRename(node: TreeNode) {
  editing.value = node.id
  draft.value = node.label
  await nextTick()
  focusRenameInput()
}

watch(
  () => store.renamingNodeId,
  (id) => {
    const node = props.nodes.find((item) => item.id === id)
    if (!node) return
    void beginRename(node)
    store.renamingNodeId = null
  },
)

function commitRename(node: TreeNode) {
  const value = draft.value
  editing.value = null
  if (!value.trim() || value === node.label) return
  if (node.tabId) store.renameTab(node.tabId, value)
  else void store.renameNode(node.id, value)
}

function removeNode(node: TreeNode) {
  if (node.tabId) void store.closeTab(node.tabId)
  else void store.deleteNode(node.id)
}

function isActive(node: TreeNode) {
  if (node.tabId) return store.activeTabId === node.tabId
  return store.isTargetActive(node.targetId)
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
  return props.nodes[index + 1]?.id ?? props.nextRootId
}

function hintClass(node: TreeNode) {
  const [id, zone] = (dropHint.value ?? '').split(':')
  return id === node.id ? dropZoneClass[zone as DropZone] : ''
}

function rowHint(node: TreeNode) {
  const [id, zone] = (dropHint.value ?? '').split(':')
  return id === node.id && (zone === 'before' || zone === 'after') ? zone : null
}

function dropOnNode(drag: SidebarDrag, node: TreeNode, zone: DropZone) {
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

const dragCleanups = new WeakMap<HTMLElement, () => void>()
const vDragSource: ObjectDirective<HTMLElement, TreeNode> = {
  mounted(element, { value: node }) {
    if (node.tabId) return
    const drag: SidebarDrag = props.pinned
      ? { type: 'favorite', id: node.id, targetId: node.targetId! }
      : { type: 'node', id: node.id }
    dragCleanups.set(element, registerSidebarDrag(element, drag))
  },
  unmounted(element) {
    dragCleanups.get(element)?.()
    dragCleanups.delete(element)
  },
}

const dropCleanups = new WeakMap<HTMLElement, () => void>()
const vDropTarget: ObjectDirective<HTMLElement, TreeNode> = {
  mounted(element, { value: node }) {
    dropCleanups.set(
      element,
      registerSidebarDrop(element, {
        canDrop: (drag) =>
          allows(
            drag,
            node,
            rowZone(
              { clientY: element.getBoundingClientRect().top + element.clientHeight / 2 },
              element,
              !props.pinned && node.kind === 'folder',
            ),
          ),
        onMove: (drag, input) => {
          const zone = rowZone(input, element, !props.pinned && node.kind === 'folder')
          if (allows(drag, node, zone)) setDropHint(`node:${node.id}`, `${node.id}:${zone}`)
        },
        onLeave: () => clearDropHint(`node:${node.id}`),
        onDrop: (drag, input) => {
          const zone = rowZone(input, element, !props.pinned && node.kind === 'folder')
          if (allows(drag, node, zone)) dropOnNode(drag, node, zone)
        },
      }),
    )
  },
  unmounted(element) {
    dropCleanups.get(element)?.()
    dropCleanups.delete(element)
  },
}
</script>

<template>
  <ul
    class="flex w-full min-w-0 flex-col gap-1"
    :data-tab-container="props.parentId ? 'folder' : undefined"
    :data-folder-id="props.parentId ?? undefined"
    :class="[
      props.parentId ? 'min-h-8 py-1 pe-1 ps-3' : '',
      props.parentId && activeDrag?.type === 'tab' ? 'min-h-10' : '',
    ]"
  >
    <template v-for="node in nodes" :key="node.id">
      <TabRow
        v-if="node.tabId"
        :id="node.tabId"
        :label="node.label"
        :detail="store.sessionById.get(node.sessionIds[0])?.detail"
        :state="rowState(node)"
        pinned
        :grouped="store.splitGroups.some((group) => group.tabIds.includes(node.tabId!))"
        @move="moveTabByKey(node, $event)"
        @drop-tab="
          $event.edge
            ? store.linkTabs($event.id, node.tabId!, $event.edge)
            : store.placeTab($event.id, props.parentId, node.tabId ?? null)
        "
      />
      <SidebarMenuItem
        v-else
        v-drag-source="node"
        v-drop-target="node"
        class="relative transition-[background-color,opacity] duration-150"
        :class="[
          activeDrag?.id === node.id ? 'opacity-40' : '',
          node.kind === 'folder' && !collapsed.has(node.id)
            ? 'rounded-lg bg-sidebar-accent/45'
            : '',
        ]"
        @contextmenu.stop.prevent="openRowMenu(node.id)"
      >
        <DropRowIndicator v-if="rowHint(node)" :position="rowHint(node)!" />
        <SidebarMenuButton
          :is-active="isActive(node)"
          :role="node.kind === 'folder' ? undefined : 'tab'"
          :aria-selected="node.kind === 'folder' ? undefined : isActive(node)"
          :aria-expanded="node.kind === 'folder' ? !collapsed.has(node.id) : undefined"
          :class="rowHint(node) ? '' : hintClass(node)"
          :data-sidebar-drop="node.kind === 'folder' ? 'folder' : undefined"
          :data-drop-id="node.kind === 'folder' ? node.id : undefined"
          @click="activate(node, $event)"
          @auxclick.middle.prevent="closeUnique(node)"
          @keydown.alt.up.prevent="store.moveNode(node.id, -1)"
          @keydown.alt.down.prevent="store.moveNode(node.id, 1)"
        >
          <span class="relative flex shrink-0 items-center">
            <component
              :is="nodeIcon(node.kind, node.kind === 'folder' && !collapsed.has(node.id))"
              :size="16"
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

          <InlineRenameInput
            v-if="editing === node.id"
            ref="input"
            v-model="draft"
            label="Nom"
            @click.stop
            @keydown.enter.prevent="commitRename(node)"
            @keydown.esc.prevent="editing = null"
            @blur="commitRename(node)"
          />
          <span v-else class="truncate" @dblclick.stop="beginRename(node)">{{ node.label }}</span>
        </SidebarMenuButton>

        <SidebarMenuAction
          v-if="canClose(node)"
          show-on-hover
          :aria-label="`Fermer ${node.label}`"
          @click.stop="closeUnique(node)"
        >
          <X :stroke-width="1.5" />
        </SidebarMenuAction>
        <DropdownMenu
          :open="menuFor === node.id"
          @update:open="(open) => (menuFor = open ? node.id : null)"
        >
          <DropdownMenuTrigger as-child>
            <button
              class="pointer-events-none absolute inset-0 opacity-0"
              tabindex="-1"
              aria-hidden="true"
              @contextmenu.stop.prevent
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" class="w-52">
            <DropdownMenuItem @select="beginRename(node)">
              <Pencil :stroke-width="1.5" />
              Renommer
            </DropdownMenuItem>
            <DropdownMenuItem
              v-if="node.kind === 'folder'"
              @select="store.createFolderAfter(node.id)"
            >
              <FolderPlus :stroke-width="1.5" />
              Nouveau dossier après
            </DropdownMenuItem>
            <DropdownMenuItem v-if="canClose(node)" @select="closeUnique(node)">
              <X :stroke-width="1.5" />
              Fermer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" @select="removeNode(node)">
              <Trash2 :stroke-width="1.5" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <SidebarTree
          v-if="node.kind === 'folder' && !collapsed.has(node.id)"
          :nodes="node.children"
          :parent-id="node.id"
        />
      </SidebarMenuItem>
    </template>
  </ul>
</template>
