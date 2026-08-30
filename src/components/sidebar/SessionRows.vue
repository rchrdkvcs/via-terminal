<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import TabRow from './TabRow.vue'

const props = withDefaults(defineProps<{ pinned?: boolean }>(), { pinned: false })
const store = useAppStore()

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
      grouped: store.splitGroups.some((group) => group.tabIds.includes(tab.id)),
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

function dropTab(
  payload: { id: string; zone?: 'before' | 'after'; edge?: 'left' | 'right' | 'top' | 'bottom' },
  targetIndex: number,
) {
  const targetId = rows.value[targetIndex]?.id
  if (payload.edge && targetId) {
    void store.linkTabs(payload.id, targetId, payload.edge)
    return
  }
  const zone = payload.zone ?? 'after'
  const beforeId = zone === 'before' ? rows.value[targetIndex]?.id : rows.value[targetIndex + 1]?.id
  if (props.pinned) void store.pinTab(payload.id, beforeId ?? null)
  else void store.unpinTab(payload.id, beforeId ?? null)
}

function dropAtEnd(event: DragEvent) {
  const tabId = event.dataTransfer?.getData('application/x-terminarr-tab')
  if (!tabId) return
  event.preventDefault()
  if (props.pinned) void store.pinTab(tabId, null)
  else void store.unpinTab(tabId, null)
}
</script>

<template>
  <ul
    class="flex w-full min-w-0 flex-col gap-1"
    role="tablist"
    :aria-label="props.pinned ? 'Onglets épinglés' : 'Sessions ouvertes'"
    aria-orientation="vertical"
    :data-tab-container="props.pinned ? 'pinned' : 'open'"
    @dragover.prevent
    @drop.self="dropAtEnd"
  >
    <TabRow
      v-for="(row, index) in rows"
      :id="row.id"
      :key="row.id"
      :label="row.label"
      :detail="row.detail"
      :state="row.state"
      :pinned="props.pinned"
      :grouped="row.grouped"
      @move="moveByKey(index, $event)"
      @drop-tab="dropTab($event, index)"
    />
  </ul>
</template>
