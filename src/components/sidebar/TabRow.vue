<script setup lang="ts">
import { nextTick, ref } from 'vue'
import { Pencil, Pin, PinOff, SquareTerminal, X } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { SidebarMenuAction, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  id: string
  label: string
  detail?: string
  state: 'online' | 'offline' | 'pending' | 'idle'
  pinned?: boolean
  depth?: number
}>()
const emit = defineEmits<{ move: [direction: -1 | 1] }>()
const store = useAppStore()
const editing = ref(false)
const draft = ref('')
const input = ref<InstanceType<typeof Input> | null>(null)
const menuOpen = ref(false)

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
</script>

<template>
  <SidebarMenuItem
    class="terminal-tab relative transition-opacity"
    :data-tab-id="id"
    @contextmenu.prevent="menuOpen = true"
  >
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
      :aria-label="`Fermer ${label}`"
      @click.stop="store.closeTab(id)"
    >
      <X :stroke-width="1.5" />
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
        <DropdownMenuItem variant="destructive" @select="store.closeTab(id)">
          <X :stroke-width="1.5" />Fermer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </SidebarMenuItem>
</template>
