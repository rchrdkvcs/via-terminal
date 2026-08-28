<script setup lang="ts">
import { ref } from 'vue'
import { Check, Download, ShieldCheck } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { api, describeError, isNative } from '@/ipc/client'
import type { Density, ThemePreference } from '@/ipc/types'
import { densityLabels, themeLabels } from '@/lib/preferences'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const pin = ref('')
const pinMessage = ref('')
const exportState = ref('')

async function savePin() {
  try {
    await store.configurePin(pin.value)
    pin.value = ''
    pinMessage.value = 'PIN enregistré.'
  } catch (error) {
    pinMessage.value = describeError(error)
  }
}

async function exportData() {
  try {
    const json = await api.exportData()
    await navigator.clipboard.writeText(json)
    exportState.value = 'Export copié dans le presse-papiers (sans secret ni contenu de terminal).'
  } catch (error) {
    exportState.value = describeError(error)
  }
}
</script>

<template>
  <Dialog v-model:open="store.settingsOpen">
    <!-- Taller than most windows: the body scrolls so no control is ever clipped. -->
    <DialogContent class="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Réglages</DialogTitle>
        <DialogDescription>
          Ces choix s’appliquent immédiatement à toutes les fenêtres.
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-6">
        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Apparence
          </h3>

          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <Label for="theme">Thème</Label>
              <p class="text-xs text-muted-foreground">« Système » suit le réglage de Windows.</p>
            </div>
            <Select
              :model-value="store.settings.theme"
              @update:model-value="store.setTheme($event as ThemePreference)"
            >
              <SelectTrigger id="theme" class="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(label, value) in themeLabels" :key="value" :value="value">
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <Label for="density">Densité</Label>
              <p class="text-xs text-muted-foreground">Hauteur des lignes de la barre latérale.</p>
            </div>
            <Select
              :model-value="store.settings.density"
              @update:model-value="store.setDensity($event as Density)"
            >
              <SelectTrigger id="density" class="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem v-for="(label, value) in densityLabels" :key="value" :value="value">
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </section>

        <Separator />

        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Terminal
          </h3>

          <div class="space-y-2">
            <div class="flex items-center justify-between gap-4">
              <Label for="font-size">Taille de police</Label>
              <span class="text-xs tabular-nums text-muted-foreground">
                {{ store.settings.fontSize }} px
              </span>
            </div>
            <Slider
              id="font-size"
              :model-value="[store.settings.fontSize]"
              :min="10"
              :max="24"
              :step="1"
              @update:model-value="store.updateSettings({ fontSize: ($event ?? [14])[0] })"
            />
          </div>

          <div class="space-y-2">
            <Label for="font-family">Police</Label>
            <Input
              id="font-family"
              :model-value="store.settings.fontFamily"
              placeholder="Cascadia Mono"
              @update:model-value="store.updateSettings({ fontFamily: String($event) })"
            />
          </div>

          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <Label for="cursor">Curseur</Label>
              <p class="text-xs text-muted-foreground">Forme du curseur dans le terminal.</p>
            </div>
            <Select
              :model-value="store.preferences.cursorStyle"
              @update:model-value="
                store.updatePreferences({ cursorStyle: $event as 'block' | 'bar' | 'underline' })
              "
            >
              <SelectTrigger id="cursor" class="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Barre</SelectItem>
                <SelectItem value="block">Bloc</SelectItem>
                <SelectItem value="underline">Souligné</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <Label for="screen-reader">Mode lecteur d’écran</Label>
              <p class="text-xs text-muted-foreground">
                Expose le contenu du terminal à NVDA. Réduit le débit sur les sorties très
                volumineuses.
              </p>
            </div>
            <Switch
              id="screen-reader"
              :model-value="store.preferences.screenReaderMode"
              @update:model-value="store.updatePreferences({ screenReaderMode: $event })"
            />
          </div>

          <div class="flex items-center justify-between gap-4">
            <div class="min-w-0">
              <Label for="restore">Relancer les shells locaux</Label>
              <p class="text-xs text-muted-foreground">
                Au démarrage. Les connexions SSH ne sont jamais rétablies automatiquement.
              </p>
            </div>
            <Switch
              id="restore"
              :model-value="store.settings.restoreLocalSessions"
              @update:model-value="store.updateSettings({ restoreLocalSessions: $event })"
            />
          </div>
        </section>

        <Separator />

        <section class="space-y-4">
          <h3 class="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Confidentialité
          </h3>

          <div class="space-y-2">
            <Label for="pin">Code PIN de verrouillage</Label>
            <p class="text-xs text-muted-foreground">
              Au moins 4 chiffres. Le PIN masque l’écran ; il ne chiffre pas la base locale.
            </p>
            <div class="flex gap-2">
              <Input
                id="pin"
                v-model="pin"
                type="password"
                inputmode="numeric"
                autocomplete="new-password"
                placeholder="••••"
              />
              <Button
                variant="secondary"
                class="gap-2 active:scale-[0.96]"
                :disabled="!/^\d{4,}$/.test(pin)"
                @click="savePin"
              >
                <ShieldCheck :size="15" :stroke-width="1.5" />
                Enregistrer
              </Button>
            </div>
            <p v-if="pinMessage" class="text-xs text-muted-foreground" aria-live="polite">
              {{ pinMessage }}
            </p>
          </div>

          <div v-if="isNative()" class="space-y-2">
            <Label>Export</Label>
            <p class="text-xs text-muted-foreground">
              Organisation seulement : aucun secret, aucun contenu de terminal.
            </p>
            <Button variant="outline" class="gap-2 active:scale-[0.96]" @click="exportData">
              <Download :size="15" :stroke-width="1.5" />
              Copier l’export JSON
            </Button>
            <p v-if="exportState" class="text-xs text-muted-foreground" aria-live="polite">
              <Check :size="12" :stroke-width="1.5" class="inline" />
              {{ exportState }}
            </p>
          </div>
        </section>
      </div>
    </DialogContent>
  </Dialog>
</template>
