<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { Lock } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { describeError } from '@/ipc/client'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const pin = ref('')
const error = ref('')
const field = ref<InstanceType<typeof Input>>()

async function submit() {
  error.value = ''
  try {
    await store.unlock(pin.value)
    pin.value = ''
  } catch (unlockError) {
    error.value = describeError(unlockError)
  }
}

watch(
  () => store.locked,
  (locked) => {
    if (!locked) return
    pin.value = ''
    error.value = ''
    void nextTick(() => field.value?.$el?.focus?.())
  },
)
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150 ease-out"
    enter-from-class="opacity-0"
    leave-active-class="transition-opacity duration-150 ease-out"
    leave-to-class="opacity-0"
  >
    <!--
      The lock screen is a barrier, not a dialog: it covers every window region
      and takes focus, so nothing behind it can be reached by keyboard.
    -->
    <div
      v-if="store.locked"
      class="fixed inset-0 z-100 flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
    >
      <span
        class="grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary shadow-lg"
      >
        <Lock :size="24" :stroke-width="1.5" />
      </span>

      <div class="space-y-1.5 text-center">
        <h1 id="lock-title" class="text-xl font-semibold">Terminarr est verrouillé</h1>
        <p class="max-w-sm text-sm text-muted-foreground">
          Vos sessions restent actives en arrière-plan.
        </p>
      </div>

      <form class="flex w-64 flex-col gap-3" @submit.prevent="submit">
        <Label for="unlock-pin" class="sr-only">Code PIN</Label>
        <Input
          id="unlock-pin"
          ref="field"
          v-model="pin"
          type="password"
          inputmode="numeric"
          autocomplete="current-password"
          placeholder="••••"
          class="text-center tracking-[0.4em]"
        />
        <p v-if="error" role="alert" class="text-center text-xs text-destructive">{{ error }}</p>
        <Button type="submit" class="active:scale-[0.96]">Déverrouiller</Button>
      </form>
    </div>
  </Transition>
</template>
