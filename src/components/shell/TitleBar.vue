<script setup lang="ts">
import { computed } from 'vue'
import { FolderTree, KeyRound, PanelLeft, Settings } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useFiles } from '@/stores/files'
import { useWorkbench } from '@/stores/workbench'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi, type Route } from '@/stores/ui'
import AddressPill from './AddressPill.vue'
import WindowControls from './WindowControls.vue'
import UpdateButton from './UpdateButton.vue'

const files = useFiles()
const workbench = useWorkbench()
const remote = computed(() => {
  const tab = workbench.activeTab
  return tab && tab.target.kind !== 'local' && !tab.view ? tab : null
})
const filesShown = computed(
  () => !!remote.value && ui.route === 'workbench' && files.state(remote.value.id).visible,
)
function toggleFiles() {
  if (!remote.value) return
  files.setVisible(remote.value.id, !filesShown.value)
  ui.route = 'workbench'
}
const settings = useSettings()
const spaces = useSpaces()
const ui = useUi()
const kbd = useShortcutLabel()

const toggle = (route: Route) => (ui.route = ui.route === route ? 'workbench' : route)

const button =
  'press grid size-7 shrink-0 place-items-center rounded-md text-ink-muted outline-none transition-[background-color,color,box-shadow] duration-100 hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40 aria-[current=true]:bg-control aria-[current=true]:text-foreground aria-[current=true]:shadow-[var(--shadow-control)]'
const tools = [
  { route: 'vault' as Route, label: 'Coffre', shortcut: 'vault' as const, icon: KeyRound },
  { route: 'settings' as Route, label: 'Réglages', shortcut: 'settings' as const, icon: Settings },
]
</script>

<template>
  <div data-tauri-drag-region class="grid h-10 w-full shrink-0 grid-cols-3 items-center gap-2 px-1">
    <div
      data-tauri-drag-region
      class="flex h-full min-w-0 items-center"
      :class="settings.platform === 'macos' ? 'ps-[72px]' : ''"
    >
      <button
        type="button"
        :class="button"
        :aria-label="
          spaces.sidebar.visible ? 'Masquer la barre latérale' : 'Afficher la barre latérale'
        "
        :aria-expanded="spaces.sidebar.visible"
        :title="`Barre latérale (${kbd('sidebar')})`"
        @click="spaces.setSidebar({ visible: !spaces.sidebar.visible })"
      >
        <PanelLeft :size="15" :stroke-width="1.5" />
      </button>
    </div>
    <AddressPill class="min-w-0 max-w-md justify-self-center" />
    <div data-tauri-drag-region class="flex h-full items-center justify-end gap-0.5">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            :class="[
              button,
              'aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-expanded:bg-control aria-expanded:text-foreground aria-expanded:shadow-[var(--shadow-control)]',
            ]"
            aria-label="Explorateur distant"
            :aria-disabled="!remote || undefined"
            :aria-expanded="remote ? filesShown : undefined"
            @click="toggleFiles"
          >
            <FolderTree :size="15" :stroke-width="1.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{{
          remote ? 'Explorateur distant' : 'Explorateur distant : terminaux SSH uniquement'
        }}</TooltipContent>
      </Tooltip>
      <UpdateButton />
      <Tooltip v-for="tool in tools" :key="tool.route">
        <TooltipTrigger as-child>
          <button
            type="button"
            :class="button"
            :aria-label="tool.label"
            :aria-current="ui.route === tool.route ? 'true' : undefined"
            @click="toggle(tool.route)"
          >
            <component :is="tool.icon" :size="15" :stroke-width="1.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {{ tool.label }}<span class="ms-2 text-ink-faint">{{ kbd(tool.shortcut) }}</span>
        </TooltipContent>
      </Tooltip>
      <template v-if="settings.platform !== 'macos'">
        <div class="mx-1.5 h-4 w-px bg-hairline" role="separator" />
        <WindowControls />
      </template>
    </div>
  </div>
</template>
