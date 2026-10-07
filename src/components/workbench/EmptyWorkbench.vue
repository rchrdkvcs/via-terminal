<script setup lang="ts">
import { computed } from 'vue'
import { Search, Server, Terminal } from '@lucide/vue'
import { Kbd } from '@/components/ui/kbd'
import { useHostName } from '@/composables/useHostName'
import { useShortcutLabel } from '@/composables/useShortcutLabel'
import { spaceIcon } from '@/components/sidebar/spaceIcons'
import { rows } from '@/domain/space'
import { useSettings } from '@/stores/settings'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'
import { useVault } from '@/stores/vault'
import { useWorkbench } from '@/stores/workbench'

const settings = useSettings()
const spaces = useSpaces()
const ui = useUi()
const vault = useVault()
const workbench = useWorkbench()
const kbd = useShortcutLabel()
const hostName = useHostName()

const shell = computed(() => settings.shellFor(spaces.active.defaultShell))
const recent = computed(() => vault.recentHosts.slice(0, 5))
const hasRows = computed(() => rows(spaces.active).length > 0)
</script>

<template>
  <div class="grid h-full place-items-center overflow-y-auto p-8">
    <div class="flex w-full max-w-[460px] flex-col">
      <div class="mb-6 flex items-center gap-3">
        <span class="material-control grid size-10 place-items-center rounded-[11px]">
          <component :is="spaceIcon(spaces.active.icon)" :size="18" :stroke-width="1.5" />
        </span>
        <div class="min-w-0">
          <h1 class="truncate text-[17px] font-semibold tracking-[-0.015em]">
            {{ spaces.active.name }}
          </h1>
          <p class="text-[12.5px] text-ink-muted">
            {{
              hasRows
                ? 'Choisissez un onglet dans la barre latérale, ou ouvrez-en un.'
                : 'Aucun onglet dans cet espace pour l’instant.'
            }}
          </p>
        </div>
      </div>

      <button
        type="button"
        class="material-field flex h-11 items-center gap-2.5 rounded-xl px-3.5 text-start text-[13.5px] text-ink-faint outline-none hover:text-ink-muted"
        @click="ui.openCommand({ kind: 'new' })"
      >
        <Search :size="16" :stroke-width="1.5" class="shrink-0" />
        <span class="flex-1 truncate">Rechercher un hôte ou taper utilisateur@serveur</span>
        <Kbd>{{ kbd('newTab') }}</Kbd>
      </button>

      <section v-if="shell" class="mt-6" aria-labelledby="empty-shells">
        <h2 id="empty-shells" class="mb-1 px-2.5 text-xs font-medium text-ink-faint">Terminal</h2>
        <button
          type="button"
          class="row flex h-9 w-full items-center gap-3 px-2.5 text-start text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          @click="workbench.open({ kind: 'local', shell: null, cwd: null })"
        >
          <Terminal :size="16" :stroke-width="1.5" class="text-ink-muted" />
          <span class="flex-1">{{ shell.name }}</span>
          <span class="text-xs text-ink-faint">Shell par défaut</span>
        </button>
      </section>

      <section v-if="recent.length" class="mt-4" aria-labelledby="empty-recent">
        <h2 id="empty-recent" class="mb-1 px-2.5 text-xs font-medium text-ink-faint">Récents</h2>
        <ul class="flex flex-col gap-px">
          <li v-for="host in recent" :key="host.id">
            <button
              type="button"
              class="row flex h-9 w-full items-center gap-3 px-2.5 text-start text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              @click="workbench.open({ kind: 'host', hostId: host.id })"
            >
              <Server :size="16" :stroke-width="1.5" class="text-ink-muted" />
              <span class="min-w-0 flex-1 truncate">{{ hostName(host.id) }}</span>
              <span class="truncate text-xs text-ink-faint">{{ vault.describe(host.id) }}</span>
            </button>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
