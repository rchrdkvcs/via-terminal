<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { Check, ChevronDown, UserRound, UserRoundPlus } from '@lucide/vue'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Target } from '@/ipc/types'
import { accountsFor, otherAccount } from '@/domain/accounts'
import { useVault } from '@/stores/vault'
/** The account the explorer browses as, and the other ones saved for the same server. */
const props = defineProps<{ target: Target; docked: boolean }>()
const emit = defineEmits<{ switch: [target: Target] }>()
const vault = useVault()
const accounts = computed(() => accountsFor(props.target, vault.view))
const current = computed(() => accounts.value.find((account) => account.current))
const typing = ref(false),
  name = ref(''),
  input = ref<HTMLInputElement>()
const typed = computed(() => otherAccount(props.target, vault.view, name.value))
async function type() {
  name.value = ''
  typing.value = true
  await nextTick()
  // After the menu has closed and stopped managing focus.
  requestAnimationFrame(() => input.value?.focus())
}
function submit() {
  if (!typed.value) return
  typing.value = false
  emit('switch', typed.value)
}
</script>
<template>
  <form v-if="typing" class="flex h-7 items-center" @submit.prevent="submit">
    <input
      ref="input"
      v-model="name"
      aria-label="Nom d’utilisateur"
      placeholder="utilisateur"
      spellcheck="false"
      autocomplete="off"
      class="h-7 w-28 rounded-md bg-transparent px-2 font-mono text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/30"
      @keydown.esc.prevent.stop="typing = false"
      @blur="typing = false"
    />
  </form>
  <DropdownMenu v-else>
    <DropdownMenuTrigger
      class="flex h-7 max-w-36 min-w-0 shrink-0 items-center gap-1 rounded-md px-1.5 text-xs text-ink-muted outline-none hover:bg-row-hover hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/40"
      :aria-label="`Utilisateur : ${current?.username ?? 'inconnu'}. Changer d’utilisateur`"
      title="Changer d’utilisateur"
    >
      <UserRound :size="14" :stroke-width="1.5" class="shrink-0" />
      <span class="min-w-0 truncate font-mono">{{ current?.username ?? '?' }}</span>
      <ChevronDown :size="12" :stroke-width="1.5" class="shrink-0" />
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="start"
      class="min-w-52"
      @close-auto-focus="typing && $event.preventDefault()"
    >
      <div class="px-2 py-1.5 text-xs text-ink-muted">
        {{ docked ? 'Ouvrir un onglet en tant que' : 'Parcourir en tant que' }}
      </div>
      <DropdownMenuItem
        v-for="account in accounts"
        :key="account.id"
        :disabled="account.current"
        @select="emit('switch', account.target)"
      >
        <Check :stroke-width="1.5" :class="account.current ? '' : 'invisible'" />
        <span class="font-mono">{{ account.username ?? '?' }}</span>
        <span class="ms-auto truncate ps-3 text-xs text-ink-faint">{{ account.label }}</span>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem @select="type">
        <UserRoundPlus :stroke-width="1.5" />Autre utilisateur…
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
