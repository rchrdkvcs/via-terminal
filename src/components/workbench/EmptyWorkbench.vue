<script setup lang="ts">
import { computed } from 'vue'
import { Server, SquareTerminal } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Kbd } from '@/components/ui/kbd'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useVault } from '@/stores/vault'
import { useWorkbench } from '@/stores/workbench'

/** Nothing open: the fastest ways to start, never a fake terminal frame. */
const settings = useSettings()
const spaces = useSpaces()
const ui = useUi()
const vault = useVault()
const workbench = useWorkbench()
const kbd = useShortcutLabel()

const shell = computed(() => settings.shellFor(spaces.active.defaultShell))
const recent = computed(() => vault.recentHosts.slice(0, 5))
const item =
  'flex h-9 w-full items-center gap-3 rounded-md px-3 text-start text-[13px] transition-colors duration-100 hover:bg-row-hover focus-visible:outline-2 focus-visible:outline-ring'
</script>

<template>
  <div class="grid h-full place-items-center p-8">
    <div class="w-full max-w-sm">
      <h1 class="text-base font-semibold">{{ spaces.active.name }}</h1>
      <p class="mt-1 mb-5 text-[13px] text-muted-foreground">
        Ouvrez un terminal ou tapez <span class="text-foreground">utilisateur@serveur</span> pour
        vous connecter.
      </p>
      <Button class="mb-6 w-full justify-between" @click="ui.openCommand({ kind: 'new' })">
        Nouvel onglet
        <Kbd class="bg-primary-foreground/15 text-primary-foreground">{{ kbd('newTab') }}</Kbd>
      </Button>
      <ul class="flex flex-col gap-px">
        <li v-if="shell">
          <button
            type="button"
            :class="item"
            @click="workbench.open({ kind: 'local', shell: null, cwd: null })"
          >
            <SquareTerminal :size="16" :stroke-width="1.5" class="text-muted-foreground" />
            <span class="flex-1">{{ shell.name }}</span>
          </button>
        </li>
        <li v-for="host in recent" :key="host.id">
          <button
            type="button"
            :class="item"
            @click="workbench.open({ kind: 'host', hostId: host.id })"
          >
            <Server :size="16" :stroke-width="1.5" class="text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate">{{ host.label }}</span>
            <span class="truncate text-xs text-muted-foreground">{{
              vault.describe(host.id)
            }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
