<script setup lang="ts">
import { computed } from 'vue'
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
const open = computed({
  get: () => ui.confirmation !== null,
  set: (value) => !value && (ui.confirmation = null),
})

function confirm() {
  const request = ui.confirmation
  ui.confirmation = null
  request?.run()
}
</script>

<template>
  <AlertDialog v-model:open="open">
    <AlertDialogContent v-if="ui.confirmation">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ ui.confirmation.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ ui.confirmation.description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Annuler</AlertDialogCancel>
        <AlertDialogAction
          :class="
            ui.confirmation.destructive ? 'bg-destructive text-white hover:bg-destructive/90' : ''
          "
          @click="confirm"
        >
          {{ ui.confirmation.confirm }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
