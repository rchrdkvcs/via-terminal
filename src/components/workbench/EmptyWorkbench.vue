<script setup lang="ts">
import { computed } from 'vue'
import { Search, Server, Terminal } from '@lucide/vue'
import { HomeConstellation } from '@/components/animations'
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
import HomeRow from './HomeRow.vue'
import HomeShortcuts from './HomeShortcuts.vue'

const settings = useSettings()
const spaces = useSpaces()
const ui = useUi()
const vault = useVault()
const workbench = useWorkbench()
const kbd = useShortcutLabel()
const hostName = useHostName()

const shell = computed(() => settings.shellFor(spaces.active.defaultShell))
const otherShells = computed(() =>
  settings.shells.filter((candidate) => candidate.path !== shell.value?.path).slice(0, 2),
)
const recent = computed(() => vault.recentHosts.slice(0, 6))
const hasRows = computed(() => rows(spaces.active).length > 0)
const greeting = new Date().getHours() >= 18 ? 'Bonsoir' : 'Bonjour'
</script>

<template>
  <div class="@container relative h-full overflow-y-auto">
    <div class="backdrop pointer-events-none absolute inset-0" aria-hidden="true" />

    <div
      class="relative mx-auto flex min-h-full w-full max-w-[880px] flex-col justify-center px-10 py-10"
    >
      <HomeConstellation :hosts="recent.length" class="enter mx-auto mb-2 max-w-[440px]" />

      <header class="enter mb-7 text-center" style="--delay: 60ms">
        <p class="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-faint">
          <component :is="spaceIcon(spaces.active.icon)" :size="13" :stroke-width="1.75" />
          <span class="max-w-60 truncate">{{ spaces.active.name }}</span>
        </p>
        <h1 class="text-[28px] font-semibold tracking-[-0.025em] text-balance">
          {{ greeting }}, prêt à vous connecter ?
        </h1>
        <p class="mt-1.5 text-[13.5px] text-pretty text-ink-muted">
          {{
            hasRows
              ? 'Choisissez un onglet dans la barre latérale, ou ouvrez-en un.'
              : 'Aucun onglet dans cet espace pour l’instant. Lancez un terminal ou rejoignez un serveur.'
          }}
        </p>
      </header>

      <button
        type="button"
        class="enter material-field mx-auto flex h-12 w-full max-w-[640px] items-center gap-3 rounded-[14px] px-4 text-start text-[14px] text-ink-faint outline-none hover:text-ink-muted"
        style="--delay: 120ms"
        @click="ui.openCommand({ kind: 'new' })"
      >
        <Search :size="17" :stroke-width="1.5" class="shrink-0" />
        <span class="flex-1 truncate">Rechercher un hôte ou taper utilisateur@serveur</span>
        <Kbd>{{ kbd('newTab') }}</Kbd>
      </button>

      <div
        class="enter mt-10 grid gap-x-8 gap-y-6"
        :class="recent.length ? '@2xl:grid-cols-2' : 'mx-auto w-full max-w-[640px]'"
        style="--delay: 180ms"
      >
        <section v-if="shell" aria-labelledby="empty-shells">
          <h2 id="empty-shells" class="mb-1.5 px-2.5 text-xs font-medium text-ink-faint">
            Démarrer
          </h2>
          <ul class="flex flex-col gap-px">
            <li>
              <HomeRow
                :icon="Terminal"
                :label="shell.name"
                meta="Shell par défaut"
                lit
                @click="workbench.open({ kind: 'local', shell: null, cwd: null })"
              />
            </li>
            <li v-for="other in otherShells" :key="other.path">
              <HomeRow
                :icon="Terminal"
                :label="other.name"
                @click="workbench.open({ kind: 'local', shell: other.path, cwd: null })"
              />
            </li>
          </ul>
        </section>

        <section v-if="recent.length" aria-labelledby="empty-recent">
          <h2 id="empty-recent" class="mb-1.5 px-2.5 text-xs font-medium text-ink-faint">
            Récents
          </h2>
          <ul class="flex flex-col gap-px">
            <li v-for="host in recent" :key="host.id">
              <HomeRow
                :icon="Server"
                :label="hostName(host.id)"
                :meta="vault.describe(host.id)"
                mono
                @click="workbench.show({ kind: 'host', hostId: host.id })"
              />
            </li>
          </ul>
        </section>
      </div>

      <HomeShortcuts class="enter mt-10" style="--delay: 240ms" />
    </div>
  </div>
</template>

<style scoped>
.backdrop {
  background-image: radial-gradient(var(--hairline-strong) 1px, transparent 1px);
  background-size: 22px 22px;
  mask-image: radial-gradient(ellipse 70% 55% at 50% 30%, black, transparent 75%);
}

.enter {
  animation: enter 0.45s var(--ease-out) var(--delay, 0ms) both;
}

@keyframes enter {
  from {
    opacity: 0;
    translate: 0 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .enter {
    animation: none;
  }
}
</style>
