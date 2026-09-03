<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import SidebarTree from './SidebarTree.vue'
import TabRow from './TabRow.vue'

const store = useAppStore()

const items = computed(() => {
  const tabs = store.pinnedTabs.map((tab) => ({
    kind: 'tab' as const,
    id: tab.id,
    position: tab.position,
    tab,
  }))
  const folders = store.tree.map((node) => ({
    kind: 'folder' as const,
    id: node.id,
    position:
      store.sidebarNodes.find((record) => record.id === node.id)?.position ??
      Number.MAX_SAFE_INTEGER,
    node,
  }))
  return [...tabs, ...folders].sort((a, b) => a.position - b.position)
})

function state(tabId: string) {
  const tab = store.tabs.find((item) => item.id === tabId)
  const ids = tab ? store.paneSessionIds(tab.root) : []
  const statuses = ids.map((id) => store.sessionById.get(id)?.status)
  if (statuses.includes('failed') || statuses.includes('disconnected')) return 'offline'
  if (statuses.includes('reconnecting') || statuses.includes('connecting')) return 'pending'
  if (statuses.every((status) => status === 'restorable' || status === 'closed')) return 'idle'
  return 'online'
}

function dropTab(
  payload: { id: string; zone?: 'before' | 'after'; edge?: 'left' | 'right' | 'top' | 'bottom' },
  targetId: string,
  nextId: string | null,
) {
  if (payload.edge) void store.linkTabs(payload.id, targetId, payload.edge)
  else void store.pinTab(payload.id, payload.zone === 'before' ? targetId : nextId)
}
</script>

<template>
  <TransitionGroup
    tag="ul"
    name="sidebar-list"
    class="flex w-full min-w-0 flex-col gap-1"
    role="tree"
    aria-label="Épinglés et dossiers"
  >
    <template v-for="(item, index) in items" :key="item.id">
      <TabRow
        v-if="item.kind === 'tab'"
        :id="item.tab.id"
        :label="item.tab.name"
        :detail="store.sessionById.get(store.paneSessionIds(item.tab.root)[0])?.detail"
        :state="state(item.tab.id)"
        pinned
        :grouped="store.splitGroups.some((group) => group.tabIds.includes(item.tab.id))"
        @drop-tab="
          dropTab(
            $event,
            item.tab.id,
            items.slice(index + 1).find((next) => next.kind === 'tab')?.id ?? null,
          )
        "
      />
      <SidebarTree v-else :nodes="[item.node]" :next-root-id="items[index + 1]?.id ?? null" />
    </template>
  </TransitionGroup>
</template>
