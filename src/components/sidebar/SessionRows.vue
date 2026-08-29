<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { MoreHorizontal, Pencil, Pin, Plus, SquareTerminal, X } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useAppStore } from '@/stores/app'
import type { DropZone } from '@/lib/sidebar-dnd'
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

const store = useAppStore()
const editing = ref<string | null>(null)
const draft = ref('')
const input = ref<InstanceType<typeof Input> | null>(null)

async function beginRename(id: string, label: string) {
  editing.value = id
  draft.value = label
  await nextTick()
  const element = input.value?.$el as HTMLInputElement | undefined
  element?.focus()
  element?.select()
}

function commitRename(id: string, label: string) {
  const value = draft.value.trim()
  editing.value = null
  if (value && value !== label) store.renameTab(id, value)
}

/**
 * Open tabs live in the sidebar, under the saved organization. Each row shows
 * the session it presents; a split tab shows the session of its active pane.
 */
const rows = computed(() =>
  store.unfavoritedTabs.map((tab) => {
    const ids = store.paneSessionIds(tab.root)
    const statuses = ids.map((id) => store.sessionById.get(id)?.status)
    const state =
      statuses.includes('failed') || statuses.includes('disconnected')
        ? 'offline'
        : statuses.includes('reconnecting') || statuses.includes('connecting')
          ? 'pending'
          : statuses.every((status) => status === 'restorable' || status === 'closed')
            ? 'idle'
            : 'online'
    return {
      id: tab.id,
      label: tab.name,
      detail: store.sessionById.get(ids[0])?.detail ?? '',
      kind: store.sessionById.get(ids[0])?.kind ?? 'local',
      state,
    }
  }),
)

/** Only open tabs reorder here; organizing a tab happens in the tree above. */
function draggedTabId() {
  const drag = activeDrag.value
  return drag?.type === 'tab' ? drag.id : null
}

function hintClass(id: string) {
  const [row, zone] = (dropHint.value ?? '').split(':')
  return row === id ? dropZoneClass[zone as DropZone] : ''
}

function onDragOver(event: DragEvent, id: string) {
  if (!draggedTabId()) return
  acceptDrop(event)
  dropHint.value = `${id}:${rowZone(event, false)}`
}

function onDrop(event: DragEvent, index: number) {
  event.preventDefault()
  const drag = readSidebarDrag(event)
  const zone = rowZone(event, false)
  endSidebarDrag()
  if (drag?.type !== 'tab') return
  const before = zone === 'before' ? rows.value[index] : rows.value[index + 1]
  void store.reorderTab(drag.id, before?.id ?? null)
}

/** Alt+Arrow moves a tab past its neighbour, which is the row to insert before. */
function moveByKey(index: number, direction: -1 | 1) {
  const target = direction < 0 ? rows.value[index - 1] : rows.value[index + 2]
  if (direction < 0 && !target) return
  if (direction > 0 && index >= rows.value.length - 1) return
  void store.reorderTab(rows.value[index].id, target?.id ?? null)
}
</script>

<template>
  <SidebarMenu role="tablist" aria-label="Sessions ouvertes" aria-orientation="vertical">
    <SidebarMenuItem
      v-for="(row, index) in rows"
      :key="row.id"
      draggable="true"
      class="transition-opacity"
      :class="draggedTabId() === row.id ? 'opacity-40' : ''"
      @dragstart.stop="startSidebarDrag($event, { type: 'tab', id: row.id })"
      @dragend.stop="endSidebarDrag()"
    >
      <SidebarMenuButton
        :as="editing === row.id ? 'div' : 'button'"
        role="tab"
        :aria-selected="row.id === store.activeTabId"
        :tabindex="row.id === store.activeTabId ? 0 : -1"
        :is-active="row.id === store.activeTabId"
        :title="row.detail || row.label"
        :class="hintClass(row.id)"
        @click="store.selectTab(row.id)"
        @auxclick.middle.prevent="store.closeTab(row.id)"
        @keydown.alt.up.prevent="moveByKey(index, -1)"
        @keydown.alt.down.prevent="moveByKey(index, 1)"
        @dragenter="onDragOver($event, row.id)"
        @dragover="onDragOver($event, row.id)"
        @drop="onDrop($event, index)"
      >
        <span class="relative flex shrink-0 items-center">
          <SquareTerminal :stroke-width="1.5" class="text-sidebar-foreground/60" />
          <!-- Colour marks the state; the tooltip and the pane header name it. -->
          <span
            v-if="row.state !== 'online'"
            class="absolute -end-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-sidebar"
            :class="{
              'bg-state-offline': row.state === 'offline',
              'bg-state-pending': row.state === 'pending',
              'bg-muted-foreground': row.state === 'idle',
            }"
            aria-hidden="true"
          />
        </span>
        <Input
          v-if="editing === row.id"
          ref="input"
          v-model="draft"
          class="h-6 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          aria-label="Nom de l’onglet"
          @click.stop
          @keydown.enter.prevent="commitRename(row.id, row.label)"
          @keydown.esc.prevent="editing = null"
          @blur="commitRename(row.id, row.label)"
        />
        <span v-else class="truncate" @dblclick.stop="beginRename(row.id, row.label)">{{
          row.label
        }}</span>
      </SidebarMenuButton>

      <SidebarMenuAction
        show-on-hover
        :aria-label="`Fermer ${row.label}`"
        @click="store.closeTab(row.id)"
      >
        <X :stroke-width="1.5" />
      </SidebarMenuAction>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuAction show-on-hover class="end-7" :aria-label="`Options de ${row.label}`">
            <MoreHorizontal :stroke-width="1.5" />
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <DropdownMenuItem v-if="row.kind === 'ssh'" @select="store.organizeTab(row.id)">
            <Pin :stroke-width="1.5" />Épingler dans l’espace
          </DropdownMenuItem>
          <DropdownMenuItem @select="beginRename(row.id, row.label)">
            <Pencil :stroke-width="1.5" />Renommer
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" @select="store.closeTab(row.id)">
            <X :stroke-width="1.5" />Fermer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>

    <SidebarMenuItem>
      <SidebarMenuButton class="text-sidebar-foreground/60" @click="store.createTerminal()">
        <Plus :stroke-width="1.5" />
        <span>Nouveau terminal</span>
        <kbd
          class="ms-auto shrink-0 rounded border px-1 py-px font-mono text-[10px] text-sidebar-foreground/50"
        >
          Ctrl T
        </kbd>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
