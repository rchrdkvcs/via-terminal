/** Owns the native update resource and serializes checks and installation. */
import { computed, ref, shallowRef } from 'vue'
import { defineStore } from 'pinia'
import { check as checkNative, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { isNative, describeError } from '@/ipc/client'
import { prepareUpdate } from '@/updates/prepare'

type Phase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'preparing'
  | 'installing'
  | 'installed'
  | 'restarting'

export const useUpdates = defineStore('updates', () => {
  const update = shallowRef<Update | null>(null)
  const phase = ref<Phase>('idle')
  const error = ref<string | null>(null)
  const dialogOpen = ref(false)
  const downloaded = ref(false)
  const received = ref(0)
  const total = ref<number | undefined>()
  const busy = computed(() =>
    ['checking', 'downloading', 'preparing', 'installing', 'restarting'].includes(phase.value),
  )
  const installing = computed(() => busy.value && phase.value !== 'checking')
  const version = computed(() => update.value?.version ?? '')
  const notes = computed(() => update.value?.body ?? '')
  const progress = computed(() =>
    total.value ? Math.min(100, Math.floor((received.value * 100) / total.value)) : undefined,
  )

  async function check(manual = false) {
    if (busy.value || phase.value === 'installed') return
    if (!isNative()) {
      if (manual) error.value = 'La vérification est disponible dans l’application installée.'
      return
    }
    phase.value = 'checking'
    error.value = null
    try {
      const next = await checkNative({ timeout: 15_000 })
      const previous = update.value
      update.value = next
      downloaded.value = false
      void previous?.close().catch(() => undefined)
    } catch (cause) {
      if (manual) error.value = `Vérification impossible. ${describeError(cause)}`
    }
    phase.value = update.value ? 'available' : 'idle'
    if (manual && update.value) dialogOpen.value = true
  }

  function onProgress(event: DownloadEvent) {
    if (event.event === 'Started') {
      total.value = event.data.contentLength
      received.value = 0
    } else if (event.event === 'Progress') received.value += event.data.chunkLength
  }

  async function restart() {
    if (phase.value !== 'installed') return
    phase.value = 'restarting'
    error.value = null
    try {
      await prepareUpdate()
      await relaunch()
    } catch (cause) {
      phase.value = 'installed'
      error.value = `Redémarrage impossible. Fermez puis rouvrez Via. ${describeError(cause)}`
    }
  }

  async function install() {
    if (!update.value || busy.value || phase.value === 'installed') return
    dialogOpen.value = true
    error.value = null
    try {
      if (!downloaded.value) {
        phase.value = 'downloading'
        await update.value.download(onProgress, { timeout: 120_000 })
        downloaded.value = true
      }
      phase.value = 'preparing'
      await prepareUpdate()
      phase.value = 'installing'
      // Windows exits here and its installer relaunches Via. Other OSes return.
      await update.value.install()
      phase.value = 'installed'
      await restart()
    } catch (cause) {
      phase.value = 'available'
      error.value = `Mise à jour interrompue. ${describeError(cause)}`
    }
  }

  return {
    phase,
    error,
    dialogOpen,
    busy,
    installing,
    version,
    notes,
    progress,
    check,
    install,
    restart,
  }
})
