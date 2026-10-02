<script setup lang="ts">
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { bindings, comboFor, keyLabels } from '@/lib/shortcuts'
import { useSettings } from '@/stores/settings'

const store = useSettings()
</script>

<template>
  <section aria-label="Raccourcis">
    <p class="pb-2 text-xs text-muted-foreground">
      Ctrl et Maj ensemble laissent les raccourcis d’édition du shell intacts. F2 renomme l’onglet
      sélectionné dans la barre latérale.
    </p>
    <dl>
      <div
        v-for="binding in bindings"
        :key="binding.id"
        class="flex items-center justify-between gap-6 py-2"
      >
        <dt class="text-[13px] text-foreground">{{ binding.label }}</dt>
        <dd>
          <KbdGroup>
            <Kbd
              v-for="key in keyLabels(comboFor(binding, store.platform), store.platform)"
              :key="key"
              >{{ key }}</Kbd
            >
          </KbdGroup>
        </dd>
      </div>
    </dl>
  </section>
</template>
