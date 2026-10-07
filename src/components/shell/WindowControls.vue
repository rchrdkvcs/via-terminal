<script setup lang="ts">
import { Copy, Minus, Square, X } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { isNative } from '@/ipc/client'

const maximized = ref(false)

async function current() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

async function act(action: 'minimize' | 'toggleMaximize' | 'close') {
  if (!isNative()) return
  const window = await current()
  await window[action]()
  maximized.value = await window.isMaximized()
}

onMounted(async () => {
  if (!isNative()) return
  const window = await current()
  maximized.value = await window.isMaximized()
  await window.onResized(async () => {
    maximized.value = await window.isMaximized()
  })
})

const button =
  'grid size-7 place-items-center rounded-md text-muted-foreground transition-colors duration-100 hover:bg-row-hover hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring'
</script>

<template>
  <div class="flex items-center gap-0.5">
    <button type="button" :class="button" aria-label="Réduire" @click="act('minimize')">
      <Minus :size="14" :stroke-width="1.5" />
    </button>
    <button
      type="button"
      :class="button"
      :aria-label="maximized ? 'Restaurer' : 'Agrandir'"
      @click="act('toggleMaximize')"
    >
      <Copy v-if="maximized" :size="12" :stroke-width="1.5" class="-scale-x-100" />
      <Square v-else :size="12" :stroke-width="1.5" />
    </button>
    <button
      type="button"
      :class="[button, 'hover:!bg-destructive hover:!text-white']"
      aria-label="Fermer"
      @click="act('close')"
    >
      <X :size="15" :stroke-width="1.5" />
    </button>
  </div>
</template>
