<script setup lang="ts">
import { ref, watch } from 'vue'
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
        <AlertDialogDescription class="break-words">{{
          dialogs.current.description
        }}</AlertDialogDescription>
      </AlertDialogHeader>
      <label v-if="dialogs.current.input !== undefined" class="grid gap-2 text-sm">
        {{ dialogs.current.inputLabel ?? 'Nom ou chemin' }}
        <input
          v-model="value"
          autofocus
          class="material-field h-9 rounded-md px-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          @keydown.enter.prevent="answer(dialogs.current.actions[0].value)"
        />
      </label>
      <label v-if="dialogs.current.applyAll" class="flex items-center gap-2 text-sm"
        ><input v-model="all" type="checkbox" />Appliquer aux autres conflits de ce transfert</label
      >
      <AlertDialogFooter class="flex-wrap">
        <button
          type="button"
          class="material-control rounded-md px-3 py-2 text-sm"
          @click="answer('cancel')"
        >
          Annuler
        </button>
        <button
          v-for="action in dialogs.current.actions"
          :key="action.value"
          type="button"
          class="material-control rounded-md px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-ring"
          :class="action.destructive ? 'bg-destructive text-white' : ''"
          @click="answer(action.value)"
        >
          {{ action.label }}
        </button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
