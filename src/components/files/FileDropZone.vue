<script setup lang="ts">
import { ref } from 'vue'
defineProps<{ directory: string }>()
const emit = defineEmits<{ drop: [event: DragEvent] }>()
const dragging = ref(false)
function accepts(event: DragEvent) {
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  event.stopPropagation()
  dragging.value = true
}
function leave(event: DragEvent) {
  if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null))
    dragging.value = false
}
function drop(event: DragEvent) {
  dragging.value = false
  if (!event.dataTransfer?.types.includes('Files')) return
  event.preventDefault()
  event.stopPropagation()
  emit('drop', event)
}
</script>
<template>
  <section @dragenter="accepts" @dragover="accepts" @dragleave="leave" @drop="drop">
    <slot />
    <div
      v-if="dragging"
      class="pointer-events-none absolute inset-2 grid place-items-center rounded-lg border-2 border-dashed border-ring bg-surface/90 p-4 text-center text-sm break-all"
    >
      <div>
        <p>Déposer dans {{ directory }}</p>
        <p class="mt-2 text-xs text-ink-muted">
          Pour conserver les permissions exécutables, utilisez le bouton d’envoi.
        </p>
      </div>
    </div>
  </section>
</template>
