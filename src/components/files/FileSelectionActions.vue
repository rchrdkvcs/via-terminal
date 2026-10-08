<script setup lang="ts">
import { Download, Pencil, Shield, Trash2 } from '@lucide/vue'
import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
defineProps<{ count: number; enabled: boolean }>()
const emit = defineEmits<{ download: []; rename: []; chmod: []; remove: [] }>()
</script>
<template>
  <DropdownMenuItem :disabled="!enabled || !count" @select="emit('download')">
    <Download :stroke-width="1.5" />
    Télécharger la sélection
  </DropdownMenuItem>
  <DropdownMenuItem :disabled="!enabled || count !== 1" @select="emit('rename')">
    <Pencil :stroke-width="1.5" />
    Renommer ou déplacer
  </DropdownMenuItem>
  <DropdownMenuItem :disabled="!enabled || count !== 1" @select="emit('chmod')">
    <Shield :stroke-width="1.5" />
    Modifier les permissions
  </DropdownMenuItem>
  <DropdownMenuItem variant="destructive" :disabled="!enabled || !count" @select="emit('remove')">
    <Trash2 :stroke-width="1.5" />
    Supprimer la sélection
  </DropdownMenuItem>
</template>
