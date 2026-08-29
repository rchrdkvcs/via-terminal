<script setup lang="ts">
import { computed } from 'vue'
import { Plus, SquareTerminal, X } from '@lucide/vue'
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useAppStore } from '@/stores/app'

const store = useAppStore()

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
      panes: ids.length,
      state,
    }
  }),
)
</script>

<template>
  <SidebarMenu role="tablist" aria-label="Sessions ouvertes" aria-orientation="vertical">
    <SidebarMenuItem v-for="row in rows" :key="row.id">
      <SidebarMenuButton
        role="tab"
        :aria-selected="row.id === store.activeTabId"
        :tabindex="row.id === store.activeTabId ? 0 : -1"
        :is-active="row.id === store.activeTabId"
        :title="row.detail || row.label"
        @click="store.selectTab(row.id)"
        @auxclick.middle.prevent="store.closeTab(row.id)"
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
        <span>{{ row.label }}</span>
        <span v-if="row.panes > 1" class="shrink-0 text-xs tabular-nums text-sidebar-foreground/50">
          {{ row.panes }}
        </span>
      </SidebarMenuButton>

      <SidebarMenuAction
        show-on-hover
        :aria-label="`Fermer ${row.label}`"
        @click="store.closeTab(row.id)"
      >
        <X :stroke-width="1.5" />
      </SidebarMenuAction>
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
