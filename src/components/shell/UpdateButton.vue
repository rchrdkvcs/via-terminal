<script setup lang="ts">
import { Download } from '@lucide/vue'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useUpdates } from '@/stores/updates'

const updates = useUpdates()
</script>

<template>
  <Tooltip v-if="updates.version">
    <TooltipTrigger as-child>
      <button
        type="button"
        class="press grid size-7 shrink-0 place-items-center rounded-md text-foreground outline-none hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring/40"
        :aria-label="`Mise à jour ${updates.version} disponible`"
        @click="updates.dialogOpen = true"
      >
        <Download :size="15" :stroke-width="1.5" />
      </button>
    </TooltipTrigger>
    <TooltipContent side="bottom">Mise à jour {{ updates.version }} disponible</TooltipContent>
  </Tooltip>
</template>
