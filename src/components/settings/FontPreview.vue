<script setup lang="ts">
import { computed } from 'vue'
import { useSettings } from '@/stores/settings'

/**
 * Mirrors `MONO_STACK` in `terminal/create.ts`; importing it would pull xterm
 * into the settings chunk just for a string.
 */
const MONO_STACK = "'IBM Plex Mono', 'Cascadia Mono', Menlo, Consolas, monospace"

const store = useSettings()

const style = computed(() => {
  const { fontFamily, fontSize, lineHeight } = store.settings
  return {
    fontFamily: fontFamily ? `'${fontFamily}', ${MONO_STACK}` : MONO_STACK,
    fontSize: `${fontSize}px`,
    lineHeight: String(lineHeight),
  }
})

const cursorClass = computed(
  () =>
    ({
      bar: 'w-[2px] h-[1.1em] align-[-0.15em]',
      block: 'w-[0.6em] h-[1.1em] align-[-0.15em]',
      underline: 'w-[0.6em] h-[2px] align-[-0.1em]',
    })[store.settings.cursorStyle],
)
</script>

<template>
  <figure
    aria-label="Aperçu du terminal"
    class="overflow-hidden rounded-lg bg-surface px-4 py-3 text-surface-ink shadow-row"
  >
    <pre
      class="m-0 whitespace-pre"
      :style="style"
      aria-hidden="true"
    ><span class="text-primary">admin@prod-web</span>:~$ systemctl status nginx
<span class="text-state-live">● nginx.service - A high performance web server</span>
<span class="text-muted-foreground">     Active: active (running) since Mon 09:14:02 UTC</span>
<span class="text-primary">admin@prod-web</span>:~$ <span class="inline-block bg-current" :class="cursorClass" /></pre>
  </figure>
</template>
