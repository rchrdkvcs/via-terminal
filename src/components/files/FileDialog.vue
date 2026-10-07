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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
      <label v-if="dialogs.current.input !== undefined" class="grid gap-2 text-[13px]">
        {{ dialogs.current.inputLabel ?? 'Nom ou chemin' }}
        <Input
          v-model="value"
          :aria-invalid="!!dialogs.error"
          :aria-describedby="dialogs.error ? errorId : undefined"
          autofocus
          class="font-mono text-xs"
          @keydown.enter.prevent="answer(dialogs.current.actions[0].value)"
        />
        <p v-if="dialogs.error" :id="errorId" role="alert" class="text-xs text-foreground">
          {{ dialogs.error }}
        </p>
      </label>
      <label v-if="dialogs.current.applyAll" class="flex items-center gap-2 text-[13px]"
        ><input v-model="all" type="checkbox" class="size-3.5" />Appliquer aux autres conflits de ce
        transfert</label
      >
      <AlertDialogFooter class="flex-wrap">
        <Button type="button" variant="secondary" @click="answer('cancel')">Annuler</Button>
        <Button
          v-for="(action, index) in dialogs.current.actions"
          :key="action.value"
          type="button"
          :variant="action.destructive ? 'destructive' : index ? 'secondary' : 'default'"
          @click="answer(action.value)"
        >
          {{ action.label }}
        </Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
