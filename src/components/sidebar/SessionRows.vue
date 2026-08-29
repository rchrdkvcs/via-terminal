<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus } from '@lucide/vue'
import { useDraggable } from 'vue-draggable-plus'
import { SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { useAppStore } from '@/stores/app'
import { tabSortableOptions } from '@/lib/tab-dnd'
import TabRow from './TabRow.vue'

const props = withDefaults(defineProps<{ pinned?: boolean }>(), { pinned: false })
const store = useAppStore()
const list = ref<HTMLElement | null>(null)
useDraggable(list, tabSortableOptions())

const rows = computed(() =>
  (props.pinned ? store.pinnedTabs : store.unfavoritedTabs).map((tab) => {
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
      state,
    } as const
  }),
)

function moveByKey(index: number, direction: -1 | 1) {
  const target = direction < 0 ? rows.value[index - 1] : rows.value[index + 2]
  if (direction < 0 && !target) return
  if (direction > 0 && index >= rows.value.length - 1) return
  if (props.pinned) void store.pinTab(rows.value[index].id, target?.id ?? null)
  else void store.unpinTab(rows.value[index].id, target?.id ?? null)
}
</script>

<template>
  <ul
    ref="list"
    class="flex w-full min-w-0 flex-col gap-1"
    role="tablist"
    :aria-label="props.pinned ? 'Onglets épinglés' : 'Sessions ouvertes'"
    aria-orientation="vertical"
    :data-tab-container="props.pinned ? 'pinned' : 'open'"
  >
    <TabRow
      v-for="(row, index) in rows"
      :id="row.id"
      :key="row.id"
      :label="row.label"
      :detail="row.detail"
      :state="row.state"
      :pinned="props.pinned"
      @move="moveByKey(index, $event)"
    />

    <SidebarMenuItem v-if="!pinned">
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
  </ul>
</template>
