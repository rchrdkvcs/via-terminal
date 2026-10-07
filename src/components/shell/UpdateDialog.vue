<script setup lang="ts">
import { computed } from 'vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useUpdates } from '@/stores/updates'

const updates = useUpdates()
const open = computed({
  get: () => updates.dialogOpen,
  set: (value) => {
    if (!updates.installing) updates.dialogOpen = value
  },
})
const statuses: Partial<Record<typeof updates.phase, string>> = {
  downloading: 'Téléchargement de la mise à jour…',
  preparing: 'Enregistrement de vos modifications…',
  installing: 'Installation de la mise à jour…',
  installed: 'Mise à jour installée. Redémarrez Via pour la terminer.',
  restarting: 'Redémarrage de Via…',
}
const status = computed(() => statuses[updates.phase] ?? '')
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      data-update-dialog
      :show-close-button="!updates.installing"
      :aria-busy="updates.installing"
      @escape-key-down="updates.installing && $event.preventDefault()"
      @interact-outside="updates.installing && $event.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>Mettre Via à jour · {{ updates.version }}</DialogTitle>
        <DialogDescription>
          L’installation redémarre Via et interrompt les sessions locales et SSH. Les onglets
          temporaires et le contenu des terminaux ne sont pas restaurés.
        </DialogDescription>
      </DialogHeader>
      <div
        v-if="updates.notes"
        class="max-h-52 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed"
        aria-label="Notes de version"
      >
        {{ updates.notes }}
      </div>
      <div v-if="status" class="grid gap-2" role="status" aria-live="polite">
        <p class="text-[13px]">{{ status }}</p>
        <progress
          v-if="updates.phase === 'downloading'"
          :value="updates.progress"
          max="100"
          aria-label="Téléchargement de la mise à jour"
          class="h-2 w-full accent-foreground"
        />
        <span
          v-if="updates.phase === 'downloading' && updates.progress !== undefined"
          class="text-xs text-muted-foreground"
          >{{ updates.progress }} %</span
        >
      </div>
      <p v-if="updates.error" role="alert" class="text-[13px] text-destructive">
        {{ updates.error }}
      </p>
      <DialogFooter>
        <Button variant="ghost" :disabled="updates.installing" @click="open = false"
          >Plus tard</Button
        >
        <Button v-if="updates.phase === 'installed'" @click="updates.restart()"
          >Redémarrer Via</Button
        >
        <Button v-else :disabled="updates.busy" @click="updates.install()">
          {{ updates.installing ? 'Mise à jour en cours…' : 'Télécharger et redémarrer' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
