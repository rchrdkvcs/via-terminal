<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { ArrowLeft, ArrowRight } from '@lucide/vue'
const props = defineProps<{ variants: readonly { id: string; name: string }[]; current: string }>()
const emit = defineEmits<{ select: [id: string] }>()
function move(direction: number) {
  const index = props.variants.findIndex((item) => item.id === props.current)
  emit(
    'select',
    props.variants[(index + direction + props.variants.length) % props.variants.length].id,
  )
}
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  if (target.matches('input, textarea, select, [contenteditable="true"]')) return
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault()
    move(event.key === 'ArrowLeft' ? -1 : 1)
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div
    class="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full bg-foreground p-1 text-background shadow-xl ring-1 ring-background/20"
    aria-label="Sélecteur de prototype"
  >
    <button
      class="grid size-9 place-items-center rounded-full hover:bg-background/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background active:scale-[0.96]"
      aria-label="Prototype précédent"
      @click="move(-1)"
    >
      <ArrowLeft :size="16" :stroke-width="2" />
    </button>
    <div class="min-w-44 px-3 text-center text-xs font-medium">
      {{ current.toUpperCase() }} · {{ variants.find((item) => item.id === current)?.name }}
    </div>
    <button
      class="grid size-9 place-items-center rounded-full hover:bg-background/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-background active:scale-[0.96]"
      aria-label="Prototype suivant"
      @click="move(1)"
    >
      <ArrowRight :size="16" :stroke-width="2" />
    </button>
  </div>
</template>
