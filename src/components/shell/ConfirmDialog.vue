<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useUi } from '@/stores/ui'

/** The one confirmation dialog, driven by `ui.confirm(...)`. */
const ui = useUi()
/**
 * The action closes the dialog before its click handler runs, which clears
 * `ui.confirmation`; keep the request being shown so confirming still runs it.
 */
const shown = shallowRef(ui.confirmation)
watch(
  () => ui.confirmation,
  (request) => {
    if (request) shown.value = request
  },
)
const open = computed({
  get: () => ui.confirmation !== null,
  set: (value) => !value && (ui.confirmation = null),
})

function confirm() {
  const request = shown.value
  ui.confirmation = null
  shown.value = null
  request?.run()
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent v-if="shown">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ shown?.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ shown?.description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Annuler</AlertDialogCancel>
        <AlertDialogAction
          :class="shown?.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : ''"
          @click="confirm"
        >
          {{ shown?.confirm }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
