<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const workspace = computed(
  () => store.workspaces.find((item) => item.id === store.pendingWorkspaceDelete) ?? null,
)
</script>

<template>
  <AlertDialog
    :open="Boolean(workspace)"
    @update:open="store.pendingWorkspaceDelete = $event ? store.pendingWorkspaceDelete : null"
  >
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Supprimer « {{ workspace?.name }} » ?</AlertDialogTitle>
        <AlertDialogDescription>
          L’espace, ses dossiers et ses ressources seront retirés. Les sessions ouvertes de cet
          espace seront arrêtées.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="store.pendingWorkspaceDelete = null">Annuler</AlertDialogCancel>
        <AlertDialogAction
          class="bg-destructive text-white hover:bg-destructive/90"
          @click.capture="workspace && store.deleteWorkspace(workspace.id)"
        >
          Supprimer
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
