<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Minus, Pencil, Pin, PinOff, SquareTerminal, X } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useAppStore } from '@/stores/app'
import { activeDrag, endSidebarDrag, readSidebarDrag, startSidebarDrag } from '@/lib/sidebar-dnd'

const props = defineProps<{
  id: string
  label: string
  detail?: string
  state: 'online' | 'offline' | 'pending' | 'idle'
  pinned?: boolean
  grouped?: boolean
  depth?: number
}>()
const emit = defineEmits<{
  move: [direction: -1 | 1]
  dropTab: [
    payload: { id: string; zone?: 'before' | 'after'; edge?: 'left' | 'right' | 'top' | 'bottom' },
  ]
}>()
const store = useAppStore()
const editing = ref(false)
const draft = ref('')
const input = ref<InstanceType<typeof Input> | null>(null)
const menuOpen = ref(false)
const isGrouped = () => store.splitGroups.some((group) => group.tabIds.includes(props.id))
const dragHint = ref<'before' | 'after' | 'left' | 'right' | 'top' | 'bottom' | null>(null)

async function beginRename() {
  draft.value = props.label
  editing.value = true
  await nextTick()
  const element = input.value?.$el as HTMLInputElement | undefined
  element?.focus()
  element?.select()
}

function commitRename() {
  const value = draft.value.trim()
  editing.value = false
  if (value && value !== props.label) store.renameTab(props.id, value)
}

const running = () => props.state === 'online' || props.state === 'pending'

function beginDrag(event: DragEvent) {
  startSidebarDrag(event, { type: 'tab', id: props.id })
}

function dropTab(event: DragEvent) {
  const drag = readSidebarDrag(event)
  if (drag?.type !== 'tab' || drag.id === props.id) return
  event.preventDefault()
  const id = drag.id
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  if (x < 0.18) emit('dropTab', { id, edge: 'left' })
  else if (x > 0.82) emit('dropTab', { id, edge: 'right' })
  else if (y < 0.22) emit('dropTab', { id, edge: 'top' })
  else if (y > 0.78) emit('dropTab', { id, edge: 'bottom' })
  else emit('dropTab', { id, zone: y < 0.5 ? 'before' : 'after' })
  dragHint.value = null
}

function previewDrop(event: DragEvent) {
  if (activeDrag.value?.type !== 'tab' || activeDrag.value.id === props.id) return
  event.preventDefault()
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (event.clientX - rect.left) / rect.width
  const y = (event.clientY - rect.top) / rect.height
  dragHint.value =
    x < 0.18
      ? 'left'
      : x > 0.82
        ? 'right'
        : y < 0.22
          ? 'top'
          : y > 0.78
            ? 'bottom'
            : y < 0.5
              ? 'before'
              : 'after'
}

function runTrailingAction() {
  if (running()) void store.stopTab(props.id)
  else void store.closeTab(props.id, { force: true })
}
</script>

<template>
  <SidebarMenuItem
    class="terminal-tab relative transition-opacity"
    :class="props.grouped ? 'border-s-2 border-sidebar-ring/50 ps-0.5' : ''"
    :data-tab-id="id"
    draggable="true"
    @dragstart="beginDrag"
    @dragend="endSidebarDrag"
    @dragover="previewDrop"
    @dragleave="dragHint = null"
    @drop.stop="dropTab"
    @contextmenu.prevent="menuOpen = true"
  >
    <span
      v-if="dragHint"
      class="pointer-events-none absolute z-10 rounded-sm bg-sidebar-ring/20"
      :class="{
        'inset-x-0 top-0 h-0.5 bg-sidebar-ring': dragHint === 'before',
        'inset-x-0 bottom-0 h-0.5 bg-sidebar-ring': dragHint === 'after',
        'inset-y-1 left-0 w-1/4': dragHint === 'left',
        'inset-y-1 right-0 w-1/4': dragHint === 'right',
        'inset-x-1 top-0 h-1/3': dragHint === 'top',
        'inset-x-1 bottom-0 h-1/3': dragHint === 'bottom',
      }"
    />
    <SidebarMenuButton
      :as="editing ? 'div' : 'button'"
      role="tab"
      :aria-selected="id === store.activeTabId"
      :tabindex="id === store.activeTabId ? 0 : -1"
      :is-active="id === store.activeTabId"
      :title="detail || label"
      :style="{ paddingInlineStart: `${8 + (depth ?? 0) * 12}px` }"
      class="touch-none"
      @click="store.selectTab(id)"
      @auxclick.middle.prevent="store.closeTab(id)"
      @keydown.alt.up.prevent="emit('move', -1)"
      @keydown.alt.down.prevent="emit('move', 1)"
    >
      <span class="relative flex shrink-0 items-center">
        <SquareTerminal :stroke-width="1.5" class="text-sidebar-foreground/60" />
        <span
          class="absolute -end-0.5 -bottom-0.5 size-1.5 rounded-full ring-2 ring-sidebar"
          :class="{
            'bg-state-online': state === 'online',
            'bg-state-offline': state === 'offline',
            'bg-state-pending': state === 'pending',
            'bg-muted-foreground': state === 'idle',
          }"
          aria-hidden="true"
        />
      </span>
      <Input
        v-if="editing"
        ref="input"
        v-model="draft"
        class="h-6 min-w-0 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        aria-label="Nom de l’onglet"
        @click.stop
        @keydown.enter.prevent="commitRename"
        @keydown.esc.prevent="editing = false"
        @blur="commitRename"
      />
      <span v-else class="truncate" @dblclick.stop="beginRename">{{ label }}</span>
    </SidebarMenuButton>

    <SidebarMenuAction
      data-tab-action
      show-on-hover
      :aria-label="`${running() ? 'Arrêter' : 'Supprimer'} ${label}`"
      @click.stop="runTrailingAction"
    >
      <Minus v-if="running()" :stroke-width="1.5" />
      <X v-else :stroke-width="1.5" />
    </SidebarMenuAction>
    <DropdownMenu :open="menuOpen" @update:open="menuOpen = $event">
      <DropdownMenuTrigger as-child>
        <button
          data-tab-action
          class="pointer-events-none absolute inset-0 opacity-0"
          tabindex="-1"
          aria-hidden="true"
          @contextmenu.prevent
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem v-if="pinned" @select="store.unpinTab(id)">
          <PinOff :stroke-width="1.5" />Détacher
        </DropdownMenuItem>
        <DropdownMenuItem v-else @select="store.pinTab(id)">
          <Pin :stroke-width="1.5" />Épingler
        </DropdownMenuItem>
        <DropdownMenuItem @select="beginRename">
          <Pencil :stroke-width="1.5" />Renommer
        </DropdownMenuItem>
        <DropdownMenuItem v-if="isGrouped()" @select="store.detachFromSplit(id)">
          Détacher du split
        </DropdownMenuItem>
        <DropdownMenuItem
          v-for="workspace in store.workspaces.filter(
            (item) => item.id !== store.activeWorkspaceId,
          )"
          :key="workspace.id"
          @select="store.transferTab(id, workspace.id, false)"
        >
          Transférer cet onglet vers {{ workspace.name }}
        </DropdownMenuItem>
        <DropdownMenuItem
          v-for="workspace in isGrouped()
            ? store.workspaces.filter((item) => item.id !== store.activeWorkspaceId)
            : []"
          :key="`group-${workspace.id}`"
          @select="store.transferTab(id, workspace.id, true)"
        >
          Transférer le groupe vers {{ workspace.name }}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" @select="runTrailingAction">
          <Minus v-if="running()" :stroke-width="1.5" />
          <X v-else :stroke-width="1.5" />
          {{ running() ? 'Arrêter' : 'Supprimer' }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </SidebarMenuItem>
</template>
