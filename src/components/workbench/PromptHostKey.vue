<script setup lang="ts">
import { ShieldAlert, ShieldQuestion } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import type { Prompt, PromptAnswer } from '@/ipc/types'

defineProps<{ prompt: Extract<Prompt, { kind: 'hostKey' }> }>()
const emit = defineEmits<{ answer: [answer: PromptAnswer] }>()
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-start gap-3">
      <component
        :is="prompt.previousFingerprint ? ShieldAlert : ShieldQuestion"
        :size="22"
        :stroke-width="1.5"
        :class="prompt.previousFingerprint ? 'text-destructive' : 'text-primary'"
        class="mt-0.5 shrink-0"
      />
      <div class="space-y-1">
        <h2 class="text-[15px] font-semibold tracking-[-0.01em]">
          {{ prompt.previousFingerprint ? 'La clé de ce serveur a changé' : 'Nouveau serveur' }}
        </h2>
        <p class="text-[13px] text-muted-foreground">
          <template v-if="prompt.previousFingerprint">
            {{ prompt.address }}:{{ prompt.port }} ne présente plus la clé enregistrée. Si vous
            n’avez pas réinstallé ce serveur, quelqu’un pourrait intercepter la connexion.
          </template>
          <template v-else>
            Vérifiez que l’empreinte correspond à celle de {{ prompt.address }}:{{ prompt.port }}
            avant de lui faire confiance.
          </template>
        </p>
      </div>
    </div>
    <dl class="material-field space-y-2.5 rounded-lg p-3 text-xs">
      <div v-if="prompt.previousFingerprint">
        <dt class="text-muted-foreground">Clé enregistrée</dt>
        <dd class="font-mono break-all line-through decoration-destructive/60">
          {{ prompt.previousFingerprint }}
        </dd>
      </div>
      <div>
        <dt class="text-muted-foreground">
          {{ prompt.previousFingerprint ? 'Nouvelle clé' : 'Empreinte' }} ({{ prompt.algorithm }})
        </dt>
        <dd class="font-mono break-all">{{ prompt.fingerprint }}</dd>
      </div>
    </dl>
    <div class="flex justify-end gap-2">
      <Button variant="secondary" @click="emit('answer', { kind: 'cancel' })">Annuler</Button>
      <Button
        :variant="prompt.previousFingerprint ? 'destructive' : 'default'"
        @click="emit('answer', { kind: 'accept' })"
      >
        {{
          prompt.previousFingerprint
            ? 'Remplacer la clé et se connecter'
            : 'Faire confiance et se connecter'
        }}
      </Button>
    </div>
  </div>
</template>
