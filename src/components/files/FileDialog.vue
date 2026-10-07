<script setup lang="ts">
import { ref, watch, useId } from 'vue'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog'
import { useFileDialogs } from '@/stores/file-dialogs'
const dialogs = useFileDialogs()
const errorId = useId()
const value = ref('')
const all = ref(false)
watch(
  () => dialogs.current,
  (question) => {
    value.value = question?.input ?? ''
    all.value = false
  },
)
function answer(choice: string) {
  dialogs.answer({ choice, value: value.value, all: all.value })
}
</script>
<template>
  <AlertDialog :open="!!dialogs.current" @update:open="(open) => !open && answer('cancel')">
    <AlertDialogContent v-if="dialogs.current">
      <AlertDialogHeader>
        <AlertDialogTitle>{{ dialogs.current.title }}</AlertDialogTitle>
        <AlertDialogDescription
          class="max-h-[40vh] overflow-y-auto break-words whitespace-pre-line"
          >{{ dialogs.current.description }}</AlertDialogDescription
        >
      </AlertDialogHeader>
      <label v-if="dialogs.current.input !== undefined" class="grid gap-2 text-sm">
        {{ dialogs.current.inputLabel ?? 'Nom ou chemin' }}
        <input
          v-model="value"
          :aria-invalid="!!dialogs.error"
          :aria-describedby="dialogs.error ? errorId : undefined"
          autofocus
          class="material-field h-9 rounded-md px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @keydown.enter.prevent="answer(dialogs.current.actions[0].value)"
        />
        <p v-if="dialogs.error" :id="errorId" role="alert" class="text-xs text-foreground">
          {{ dialogs.error }}
        </p>
      </label>
      <label v-if="dialogs.current.applyAll" class="flex items-center gap-2 text-sm"
        ><input v-model="all" type="checkbox" class="size-4" />Appliquer aux autres conflits de ce
        transfert</label
      >
      <AlertDialogFooter class="flex-wrap">
        <button
          type="button"
          class="material-control press rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
          @click="answer('cancel')"
        >
          Annuler
        </button>
        <button
          v-for="action in dialogs.current.actions"
          :key="action.value"
          type="button"
          class="press rounded-md px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          :class="
            action.destructive
              ? 'bg-destructive text-destructive-foreground shadow-control'
              : 'material-control'
          "
          @click="answer(action.value)"
        >
          {{ action.label }}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
