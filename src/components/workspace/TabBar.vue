<script setup lang="ts">
import { computed } from 'vue'
import {
  Columns2,
  Copy,
  PanelLeftOpen,
  Plus,
  Rows2,
  Search,
  Settings,
  SquareTerminal,
  X,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app'

const store = useAppStore()

const tabs = computed(() => store.visibleTabs)

function statusOf(tabId: string) {
  const tab = store.tabs.find((item) => item.id === tabId)
  if (!tab) return 'closed'
  const statuses = store.paneSessionIds(tab.root).map((id) => store.sessionById.get(id)?.status)
  if (statuses.includes('failed') || statuses.includes('disconnected')) return 'failed'
  if (statuses.includes('reconnecting') || statuses.includes('connecting')) return 'pending'
  if (statuses.every((status) => status === 'restorable')) return 'restorable'
  return 'connected'
}
</script>

<template>
  <TooltipProvider :delay-duration="400">
    <header class="flex h-11 shrink-0 items-stretch gap-2 border-b bg-card pe-2">
      <Button
        v-if="!store.sidebarVisible"
        variant="ghost"
        size="icon-sm"
        class="my-auto ms-2 active:scale-[0.96]"
        aria-label="Afficher la barre latérale"
        @click="store.sidebarVisible = true"
      >
        <PanelLeftOpen :size="16" :stroke-width="1.5" />
      </Button>

      <!-- Tabs scroll; the next one peeks past the edge so the overflow is visible. -->
      <div
        role="tablist"
        aria-label="Onglets"
        class="flex min-w-0 flex-1 items-end gap-1 overflow-x-auto px-2 [scrollbar-width:none]"
      >
        <button
          v-for="tab in tabs"
          :key="tab.id"
          role="tab"
          :aria-selected="tab.id === store.activeTabId"
          :tabindex="tab.id === store.activeTabId ? 0 : -1"
          class="group flex h-9 min-w-[7.5rem] max-w-52 shrink-0 items-center gap-2 rounded-t-lg pe-1.5 ps-3 text-xs transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
          :class="
            tab.id === store.activeTabId
              ? 'bg-background text-foreground'
              : 'text-muted-foreground hover:bg-accent/60'
          "
          @click="store.selectTab(tab.id)"
          @auxclick.middle.prevent="store.closeTab(tab.id)"
        >
          <SquareTerminal :size="14" :stroke-width="1.5" class="shrink-0" />
          <span class="truncate">{{ tab.name }}</span>
          <span
            v-if="statusOf(tab.id) !== 'connected'"
            class="size-1.5 shrink-0 rounded-full"
            :class="{
              'bg-destructive': statusOf(tab.id) === 'failed',
              'bg-warning': statusOf(tab.id) === 'pending',
              'bg-muted-foreground': statusOf(tab.id) === 'restorable',
            }"
            aria-hidden="true"
          />
          <span
            class="ms-auto grid size-5 shrink-0 place-items-center rounded-md opacity-0 transition-[opacity,background-color] duration-150 hover:bg-accent group-hover:opacity-100 group-focus-visible:opacity-100"
            :class="tab.id === store.activeTabId ? 'opacity-100' : ''"
            role="button"
            :aria-label="`Fermer ${tab.name}`"
            @click.stop="store.closeTab(tab.id)"
          >
            <X :size="12" :stroke-width="1.5" />
          </span>
        </button>
      </div>

      <div class="flex items-center gap-1 self-center">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="active:scale-[0.96]"
              aria-label="Nouveau terminal"
              @click="store.createTerminal()"
            >
              <Plus :size="16" :stroke-width="1.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nouveau terminal · Ctrl T</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="active:scale-[0.96]"
              aria-label="Diviser verticalement"
              :disabled="!store.activeTab"
              @click="store.splitActivePane('vertical')"
            >
              <Columns2 :size="16" :stroke-width="1.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Diviser verticalement</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="active:scale-[0.96]"
              aria-label="Diviser horizontalement"
              :disabled="!store.activeTab"
              @click="store.splitActivePane('horizontal')"
            >
              <Rows2 :size="16" :stroke-width="1.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Diviser horizontalement</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="active:scale-[0.96]"
              aria-label="Rechercher dans le terminal"
              :disabled="!store.activeSession"
              @click="store.searchOpen = true"
            >
              <Search :size="16" :stroke-width="1.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rechercher · Ctrl Maj F</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="active:scale-[0.96]"
              aria-label="Nouvelle fenêtre"
              @click="store.openWindow()"
            >
              <Copy :size="16" :stroke-width="1.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nouvelle fenêtre · Ctrl Maj N</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="active:scale-[0.96]"
              aria-label="Réglages"
              @click="store.settingsOpen = true"
            >
              <Settings :size="16" :stroke-width="1.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Réglages</TooltipContent>
        </Tooltip>
      </div>
    </header>
  </TooltipProvider>
</template>
