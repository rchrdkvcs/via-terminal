<script setup lang="ts">
import { defineAsyncComponent } from 'vue'
import 'vue-sonner/style.css'
import CommandBar from '@/components/command/CommandBar.vue'
import ConfirmDialog from '@/components/shell/ConfirmDialog.vue'
import SidebarFrame from '@/components/shell/SidebarFrame.vue'
import SpaceDialog from '@/components/shell/SpaceDialog.vue'
import TitleBar from '@/components/shell/TitleBar.vue'
import UpdateDialog from '@/components/shell/UpdateDialog.vue'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import Workbench from '@/components/workbench/Workbench.vue'
import { useBootstrap } from '@/composables/useBootstrap'
import { useWindowAppearance } from '@/composables/useWindowAppearance'
import { useShortcuts } from '@/composables/useShortcuts'
import { useSpaces } from '@/stores/spaces'
import { useUi } from '@/stores/ui'

const VaultPage = defineAsyncComponent(() => import('@/components/vault/VaultPage.vue'))
const SettingsPage = defineAsyncComponent(() => import('@/components/settings/SettingsPage.vue'))

const { ready, failure } = useBootstrap()
useShortcuts()
useWindowAppearance()
const spaces = useSpaces()
const ui = useUi()
</script>

<template>
  <TooltipProvider :delay-duration="500">
    <div class="relative flex h-full flex-col bg-chrome text-foreground">
      <template v-if="ready">
        <TitleBar />
        <div class="flex min-h-0 flex-1">
          <SidebarFrame />
          <div
            class="flex min-w-0 flex-1 flex-col pb-2"
            :class="spaces.sidebar.visible ? 'pe-2' : 'px-2'"
          >
            <!-- The terminal surface stays mounted under the vault and settings. -->
            <main
              class="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-surface text-surface-ink shadow-surface"
            >
              <Workbench v-show="ui.route === 'workbench'" />
              <VaultPage v-if="ui.route === 'vault'" class="absolute inset-0 bg-surface" />
              <SettingsPage
                v-else-if="ui.route === 'settings'"
                class="absolute inset-0 bg-surface"
              />
            </main>
          </div>
        </div>
        <CommandBar />
        <SpaceDialog />
        <ConfirmDialog />
        <UpdateDialog />
      </template>
      <div v-else-if="failure" class="grid flex-1 place-items-center p-8 text-center" role="alert">
        <div class="max-w-sm space-y-2">
          <h1 class="text-base font-semibold">Via n’a pas pu démarrer</h1>
          <p class="text-[13px] text-muted-foreground">{{ failure }}</p>
        </div>
      </div>
      <Toaster position="bottom-right" :duration="5000" />
    </div>
  </TooltipProvider>
</template>
