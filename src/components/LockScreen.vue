<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../stores/app'
import IconGlyph from './IconGlyph.vue'
const store = useAppStore()
const pin = ref('')
const error = ref('')
async function unlock() {
  if (/^\d{4,}$/.test(pin.value)) {
    try {
      await store.unlock(pin.value)
      pin.value = ''
      error.value = ''
    } catch {
      error.value = 'Code PIN incorrect.'
    }
  } else error.value = 'Saisissez au moins 4 chiffres.'
}
</script>
<template>
  <Transition name="fade"
    ><div v-if="store.locked" class="lock-screen">
      <div class="lock-mark"><IconGlyph name="Terminal" :size="28" /></div>
      <h1>Terminarr est verrouillé</h1>
      <p>Vos sessions restent actives en arrière-plan.</p>
      <form @submit.prevent="unlock">
        <label for="pin">Code PIN</label
        ><input
          id="pin"
          v-model="pin"
          type="password"
          inputmode="numeric"
          autocomplete="current-password"
          autofocus
          placeholder="••••"
        /><span v-if="error" role="alert">{{ error }}</span
        ><button class="primary">Déverrouiller</button>
      </form>
    </div></Transition
  >
</template>
