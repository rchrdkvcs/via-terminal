<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import {
  bindings,
  comboFor,
  comboOf,
  defaultCombo,
  editable,
  groupLabels,
  keyLabels,
  refusal,
  sameCombo,
  type ActionId,
  type Binding,
  type BindingGroup,
} from '@/lib/shortcuts'
import { useSettings } from '@/stores/settings'
import { useUi } from '@/stores/ui'
import SettingGroup from '../SettingGroup.vue'

const store = useSettings()
const ui = useUi()
const recording = ref<ActionId | null>(null)
const problem = ref<{ id: ActionId; message: string } | null>(null)

const groups = computed(() =>
  (Object.keys(groupLabels) as BindingGroup[]).map((group) => ({
    group,
    label: groupLabels[group],
    items: bindings.filter((binding) => binding.group === group),
  })),
)
const mac = computed(() => store.platform === 'macos')

/** ⌘⇧D on macOS, Ctrl+Maj+D elsewhere: plain text, since the field already draws the box. */
const text = (binding: Binding) =>
  keyLabels(comboFor(binding, store.platform, store.settings.keybindings), store.platform).join(
    mac.value ? '' : '+',
  )
const custom = (binding: Binding) => Boolean(store.settings.keybindings[binding.id])

function start(id: ActionId) {
  recording.value = id
  problem.value = null
  ui.recordingShortcut = true
}

function stop() {
  recording.value = null
  ui.recordingShortcut = false
}

useEventListener(
  window,
  'keydown',
  (event: KeyboardEvent) => {
    const id = recording.value
    if (!id) return
    event.preventDefault()
    event.stopPropagation()
    const plain = !event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey
    if (event.key === 'Escape' && plain) {
      problem.value = null
      stop()
      return
    }
    const combo = comboOf(event)
    if (!combo) return
    const message = refusal(combo, id, store.platform, store.settings.keybindings)
    if (message) {
      problem.value = { id, message }
      return
    }
    const binding = bindings.find((candidate) => candidate.id === id)!
    store.setKeybinding(id, sameCombo(combo, defaultCombo(binding, store.platform)) ? null : combo)
    problem.value = null
    stop()
  },
  { capture: true },
)

onBeforeUnmount(stop)
</script>

<template>
  <section aria-label="Raccourcis" class="grid gap-8">
    <p class="px-1 text-xs leading-relaxed text-pretty text-muted-foreground">
      Cliquez sur un raccourci, puis appuyez sur la nouvelle combinaison. Échap annule.
      <template v-if="!mac">
        Ctrl et Maj ensemble laissent les raccourcis d’édition du shell intacts.
      </template>
    </p>

    <SettingGroup v-for="item in groups" :key="item.group" :title="item.label">
      <div v-for="binding in item.items" :key="binding.id" class="py-2">
        <div class="flex min-h-10 items-center justify-between gap-6">
          <span :id="`shortcut-${binding.id}`" class="text-[13px] text-foreground">
            {{ binding.label }}
          </span>
          <div class="flex items-center gap-1">
            <Button
              v-if="custom(binding) && recording !== binding.id"
              variant="ghost"
              size="icon-xs"
              class="text-muted-foreground"
              :aria-label="`Rétablir le raccourci par défaut de « ${binding.label} »`"
              title="Rétablir le raccourci par défaut"
              @click="store.setKeybinding(binding.id, null)"
            >
              <RotateCcw :stroke-width="1.5" aria-hidden="true" />
            </Button>
            <button
              v-if="editable(binding.id)"
              type="button"
              :aria-labelledby="`shortcut-${binding.id}`"
              :aria-pressed="recording === binding.id"
              :aria-describedby="
                problem?.id === binding.id ? `shortcut-${binding.id}-problem` : undefined
              "
              class="flex h-7 items-center rounded-md px-2 outline-none hover:bg-row-hover focus-visible:ring-2 focus-visible:ring-ring/40 aria-pressed:bg-sunken aria-pressed:shadow-[var(--shadow-field-focus)]"
              @click="recording === binding.id ? stop() : start(binding.id)"
              @blur="recording === binding.id && stop()"
            >
              <span
                v-if="recording === binding.id"
                class="truncate text-xs text-ink-muted"
                aria-live="polite"
              >
                Tapez les touches…
              </span>
              <span v-else class="text-[13px] font-medium tracking-[0.04em] text-foreground">
                {{ text(binding) }}
              </span>
            </button>
            <div
              v-else
              class="flex h-7 items-center px-2"
              title="Ce raccourci ne peut pas être modifié"
            >
              <span class="text-[13px] font-medium tracking-[0.04em] text-ink-muted">
                {{ text(binding) }}
              </span>
            </div>
          </div>
        </div>
        <p
          v-if="problem?.id === binding.id"
          :id="`shortcut-${binding.id}-problem`"
          role="alert"
          class="pt-1 pb-1 text-end text-xs text-pretty text-destructive"
        >
          {{ problem.message }}
        </p>
      </div>
    </SettingGroup>
  </section>
</template>
