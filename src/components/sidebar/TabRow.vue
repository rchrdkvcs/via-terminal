<script setup lang="ts">
import { computed } from 'vue'
import { X } from '@lucide/vue'
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu'
import type { Tab } from '@/ipc/types'
import { useTabLabel } from '@/composables/useTabLabel'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useSessions } from '@/stores/sessions'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'
import { useTabClosing } from '@/composables/useTabClosing'
import InlineRename from './InlineRename.vue'
import RowMenu from './RowMenu.vue'
import TabIcon from './TabIcon.vue'

const props = defineProps<{ tab: Tab; compact?: boolean }>()
const sessions = useSessions()
const ui = useUi()
const workbench = useWorkbench()
const closing = useTabClosing()
const actions = useSidebarActions()
const names = useTabLabel()

const state = computed(() => sessions.runtime(props.tab.id).state)
const selected = computed(() => workbench.activeTab?.id === props.tab.id)
const label = computed(() => names.label(props.tab))
const asleep = computed(() => state.value === 'asleep' || state.value === 'exited')
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <div
        role="button"
        tabindex="0"
        :aria-current="selected ? 'page' : undefined"
        :title="names.detail(tab)"
        class="row group/tab relative flex min-w-0 items-center gap-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        :class="[
          compact ? 'h-7 flex-1 px-1.5' : 'h-8 px-2',
          selected ? 'font-medium' : '',
          asleep && !selected ? 'text-muted-foreground' : '',
        ]"
        @click="workbench.activate(tab.id)"
        @dblclick.stop="ui.renaming = tab.id"
        @keydown.enter.prevent="workbench.activate(tab.id)"
        @keydown.f2.prevent="ui.renaming = tab.id"
      >
        <TabIcon :target="tab.target" :state="state" />
        <InlineRename
          v-if="ui.renaming === tab.id"
          :value="label"
          label="Nom de l’onglet"
          @commit="(value) => (actions.rename(tab.id, value), (ui.renaming = null))"
          @cancel="ui.renaming = null"
        />
        <span v-else class="min-w-0 flex-1 truncate">{{ label }}</span>
        <button
          v-if="ui.renaming !== tab.id"
          type="button"
          class="-me-1 grid size-6 shrink-0 place-items-center rounded-[5px] text-muted-foreground opacity-0 transition-opacity duration-100 group-hover/tab:opacity-100 group-focus-within/tab:opacity-100 hover:bg-row-hover hover:text-foreground focus-visible:opacity-100"
          :aria-label="`Fermer ${label}`"
          @click.stop="closing.close(tab.id)"
        >
          <X :size="14" :stroke-width="1.5" />
        </button>
      </div>
    </ContextMenuTrigger>
    <RowMenu :tab-id="tab.id" />
  </ContextMenu>
</template>
