<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ChevronDown, ChevronUp, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { terminals } from '@/terminal/registry'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const query = ref('')
const field = ref<InstanceType<typeof Input>>()

function find(direction: 'next' | 'previous') {
  const sessionId = store.activePaneSessionId
  if (!sessionId || !query.value) return
  const search = terminals.search(sessionId)
  if (!search) return
  if (direction === 'next') search.findNext(query.value)
  else search.findPrevious(query.value)
}

function close() {
  store.searchOpen = false
  const sessionId = store.activePaneSessionId
  if (sessionId) {
    terminals.search(sessionId)?.clearDecorations()
    terminals.focus(sessionId)
  }
}

watch(
  () => store.searchOpen,
  (open) => {
    if (open) void nextTick(() => field.value?.$el?.focus?.())
  },
)
</script>

<template>
  <Transition
    enter-active-class="transition-[opacity,translate] duration-150 ease-out"
    enter-from-class="opacity-0 -translate-y-1"
    leave-active-class="transition-[opacity,translate] duration-150 ease-out"
    leave-to-class="opacity-0 -translate-y-1"
  >
    <div
      v-if="store.searchOpen"
      class="absolute end-4 top-3 z-20 flex items-center gap-1 rounded-xl border bg-popover p-1.5 shadow-lg"
      role="search"
    >
      <Input
        ref="field"
        v-model="query"
        class="h-8 w-56"
        placeholder="Rechercher dans la sortie"
        aria-label="Rechercher dans la sortie du terminal"
        @keydown.enter.exact="find('next')"
        @keydown.shift.enter="find('previous')"
        @keydown.esc="close"
      />
      <Button
        variant="ghost"
        size="icon-sm"
        class="active:scale-[0.96]"
        aria-label="Occurrence précédente"
        @click="find('previous')"
      >
        <ChevronUp :size="15" :stroke-width="1.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="active:scale-[0.96]"
        aria-label="Occurrence suivante"
        @click="find('next')"
      >
        <ChevronDown :size="15" :stroke-width="1.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        class="active:scale-[0.96]"
        aria-label="Fermer la recherche"
        @click="close"
      >
        <X :size="15" :stroke-width="1.5" />
      </Button>
    </div>
  </Transition>
</template>
