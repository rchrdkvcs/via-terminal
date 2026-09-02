<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { FolderInput, Minus, Pencil, Pin, PinOff, Terminal, Unlink, X } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import InlineRenameInput from './InlineRenameInput.vue'
import DropRowIndicator from './DropRowIndicator.vue'
import { useAppStore } from '@/stores/app'
import { clearDropHint, dropHint, registerSidebarDragAndDrop, setDropHint } from '@/lib/sidebar-dnd'

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
const input = ref<InstanceType<typeof InlineRenameInput> | null>(null)
const menuOpen = ref(false)
const isGrouped = () => store.splitGroups.some((group) => group.tabIds.includes(props.id))
type TabDropHint = 'before' | 'after' | 'left' | 'right' | 'top' | 'bottom'
const hintPrefix = computed(() => `tab:${props.id}:`)
const dragHint = computed<TabDropHint | null>(() => {
  if (!dropHint.value?.startsWith(hintPrefix.value)) return null
  return dropHint.value.slice(hintPrefix.value.length) as TabDropHint
})
const row = ref<HTMLElement | { $el: HTMLElement }>()
let cleanupDragAndDrop: (() => void) | undefined

function rowElement() {
  const value = row.value
  return value instanceof HTMLElement ? value : value?.$el
}

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

function zone(input: { clientX: number; clientY: number }) {
  const element = rowElement()
  if (!element) return null
  const rect = element.getBoundingClientRect()
  const x = (input.clientX - rect.left) / rect.width
  const y = (input.clientY - rect.top) / rect.height
  return (
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
  ) as TabDropHint
}

onMounted(() => {
  const element = rowElement()
  if (!element) return
  cleanupDragAndDrop = registerSidebarDragAndDrop(
    element,
    { type: 'tab', id: props.id },
    {
      canDrop: (drag) => drag.type === 'tab' && drag.id !== props.id,
      onMove: (_drag, input) => {
        const target = zone(input)
        if (target) setDropHint(`tab:${props.id}`, `${hintPrefix.value}${target}`)
      },
      onLeave: () => clearDropHint(`tab:${props.id}`),
      onDrop: (drag, input) => {
        if (drag.type !== 'tab') return
        const target = zone(input)
        if (target === 'left' || target === 'right' || target === 'top' || target === 'bottom')
          emit('dropTab', { id: drag.id, edge: target })
        else if (target) emit('dropTab', { id: drag.id, zone: target })
        clearDropHint(`tab:${props.id}`)
      },
    },
  )
})
onBeforeUnmount(() => cleanupDragAndDrop?.())

function runTrailingAction() {
  if (running()) void store.stopTab(props.id)
  else void store.closeTab(props.id, { force: true })
}
</script>

<template>
  <SidebarMenuItem
    ref="row"
    class="terminal-tab relative transition-opacity"
    :class="props.grouped ? 'border-s-2 border-sidebar-ring/50 ps-0.5' : ''"
    :data-tab-id="id"
    @contextmenu.stop.prevent="menuOpen = true"
  >
    <DropRowIndicator v-if="dragHint === 'before' || dragHint === 'after'" :position="dragHint" />
    <span
      v-if="dragHint && dragHint !== 'before' && dragHint !== 'after'"
      class="pointer-events-none absolute z-10 rounded-sm bg-sidebar-ring/20"
      :class="{
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
      class="touch-none"
      @click="store.selectTab(id)"
      @auxclick.middle.prevent="store.closeTab(id)"
      @keydown.alt.up.prevent="emit('move', -1)"
      @keydown.alt.down.prevent="emit('move', 1)"
    >
      <span class="relative flex shrink-0 items-center">
        <Terminal :size="16" :stroke-width="1.5" class="text-sidebar-foreground/60" />
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
      <InlineRenameInput
        v-if="editing"
        ref="input"
        v-model="draft"
        label="Nom de l’onglet"
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
      <DropdownMenuContent side="right" align="start" class="w-56">
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
          <Unlink :stroke-width="1.5" />
          Détacher du split
        </DropdownMenuItem>
        <DropdownMenuItem
          v-for="workspace in store.workspaces.filter(
            (item) => item.id !== store.activeWorkspaceId,
          )"
          :key="workspace.id"
          @select="store.transferTab(id, workspace.id, false)"
        >
          <FolderInput :stroke-width="1.5" />
          Transférer cet onglet vers {{ workspace.name }}
        </DropdownMenuItem>
        <DropdownMenuItem
          v-for="workspace in isGrouped()
            ? store.workspaces.filter((item) => item.id !== store.activeWorkspaceId)
            : []"
          :key="`group-${workspace.id}`"
          @select="store.transferTab(id, workspace.id, true)"
        >
          <FolderInput :stroke-width="1.5" />
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
