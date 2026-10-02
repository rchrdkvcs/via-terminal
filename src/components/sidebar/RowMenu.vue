<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowRightLeft,
  Columns2,
  Moon,
  Pencil,
  Pin,
  PinOff,
  RotateCw,
  Server,
  Unlink,
  X,
} from '@lucide/vue'
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
} from '@/components/ui/context-menu'
import type { Id } from '@/ipc/types'
import { findTab, isPinned, rowOfTab, splitOf } from '@/domain/space'
import { useSidebarActions } from '@/composables/useSidebarActions'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useSessions } from '@/stores/sessions'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useWorkbench } from '@/stores/workbench'
import { useTabClosing } from '@/composables/useTabClosing'

/** Every row action, so nothing is reachable only by dragging. */
const props = defineProps<{ tabId: Id }>()
const spaces = useSpaces()
const sessions = useSessions()
const ui = useUi()
const workbench = useWorkbench()
const closing = useTabClosing()
const actions = useSidebarActions()
const kbd = useShortcutLabel()

const tab = computed(() => findTab(spaces.active, props.tabId))
const row = computed(() => rowOfTab(spaces.active, props.tabId))
const pinned = computed(() => Boolean(row.value && isPinned(spaces.active, row.value.id)))
const inSplit = computed(() => Boolean(splitOf(spaces.active, props.tabId)))
const live = computed(() => sessions.isLive(props.tabId))
const otherSpaces = computed(() => spaces.spaces.filter((space) => space.id !== spaces.active.id))
</script>

<template>
  <ContextMenuContent class="w-60">
    <ContextMenuItem @select="ui.renaming = tabId">
      <Pencil :stroke-width="1.5" /> Renommer <ContextMenuShortcut>F2</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem v-if="row" @select="workbench.togglePin(row.id)">
      <component :is="pinned ? PinOff : Pin" :stroke-width="1.5" />
      {{ pinned ? 'Désépingler' : 'Épingler' }}
      <ContextMenuShortcut>{{ kbd('pin') }}</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem @select="ui.openCommand({ kind: 'replace', tabId })">
      <ArrowRightLeft :stroke-width="1.5" /> Changer la cible…
      <ContextMenuShortcut>{{ kbd('retarget') }}</ContextMenuShortcut>
    </ContextMenuItem>
    <ContextMenuItem v-if="!inSplit" @select="ui.openCommand({ kind: 'split', tabId })">
      <Columns2 :stroke-width="1.5" /> Partager la vue avec…
    </ContextMenuItem>
    <ContextMenuItem v-else @select="actions.detach(tabId)">
      <Unlink :stroke-width="1.5" /> Détacher de la vue partagée
    </ContextMenuItem>
    <ContextMenuSub v-if="otherSpaces.length">
      <ContextMenuSubTrigger>Déplacer vers l’espace</ContextMenuSubTrigger>
      <ContextMenuSubContent>
        <ContextMenuItem
          v-for="space in otherSpaces"
          :key="space.id"
          @select="actions.moveToSpace(tabId, space.id)"
        >
          {{ space.name }}
        </ContextMenuItem>
      </ContextMenuSubContent>
    </ContextMenuSub>
    <ContextMenuItem
      v-if="tab?.target.kind === 'host'"
      @select="tab.target.kind === 'host' && ui.showVault('hosts', tab.target.hostId)"
    >
      <Server :stroke-width="1.5" /> Modifier l’hôte
    </ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem v-if="live" @select="sessions.stop(tabId)">
      <Moon :stroke-width="1.5" /> Mettre en veille
    </ContextMenuItem>
    <ContextMenuItem v-else @select="workbench.reconnect(tabId)">
      <RotateCw :stroke-width="1.5" /> {{ tab?.target.kind === 'local' ? 'Démarrer' : 'Connecter' }}
    </ContextMenuItem>
    <ContextMenuItem @select="closing.close(tabId)">
      <X :stroke-width="1.5" /> Fermer
      <ContextMenuShortcut>{{ kbd('closeTab') }}</ContextMenuShortcut>
    </ContextMenuItem>
  </ContextMenuContent>
</template>
