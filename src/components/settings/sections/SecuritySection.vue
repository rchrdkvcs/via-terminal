<script setup lang="ts">
import { ref } from 'vue'
import { Lock, ShieldCheck } from '@lucide/vue'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import SettingRow from '../SettingRow.vue'
import SettingsSection from '../SettingsSection.vue'
import { describeError } from '@/ipc/client'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const pin = ref('')
const message = ref('')

async function save() {
  try {
    await store.configurePin(pin.value)
    pin.value = ''
    message.value = 'PIN enregistré. Il sera demandé au prochain verrouillage.'
  } catch (error) {
    message.value = describeError(error)
  }
}
</script>

<template>
  <SettingsSection title="Sécurité" description="Verrouillage visuel de toutes les fenêtres.">
    <Alert class="my-2">
      <ShieldCheck :stroke-width="1.5" />
      <AlertTitle>Le PIN est un écran de confidentialité</AlertTitle>
      <AlertDescription>
        Il masque le contenu et bloque les commandes natives. Il ne chiffre pas la base locale.
        Aucun contenu de terminal, aucun historique et aucun mot de passe SSH n’est écrit sur le
        disque.
      </AlertDescription>
    </Alert>

    <SettingRow
      label="Code PIN"
      description="Au moins 4 chiffres. Enregistrer un nouveau PIN remplace l’ancien."
      for-id="pin"
      stacked
    >
      <div class="flex gap-2">
        <Input
          id="pin"
          v-model="pin"
          type="password"
          inputmode="numeric"
          autocomplete="new-password"
          placeholder="••••"
          class="max-w-48"
        />
        <Button
          variant="secondary"
          class="active:scale-[0.96]"
          :disabled="!/^\d{4,}$/.test(pin)"
          @click="save"
        >
          Enregistrer
        </Button>
      </div>
      <p v-if="message" class="pt-2 text-xs text-muted-foreground" aria-live="polite">
        {{ message }}
      </p>
    </SettingRow>

    <SettingRow
      label="Verrouiller maintenant"
      description="Les sessions restent actives en arrière-plan."
    >
      <Button variant="outline" class="active:scale-[0.96]" @click="store.lock()">
        <Lock :stroke-width="1.5" />
        Verrouiller
      </Button>
    </SettingRow>
  </SettingsSection>
</template>
