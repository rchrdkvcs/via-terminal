import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { usePreferredDark } from '@vueuse/core'
import { api, describeError } from '@/ipc/client'
import type { Bootstrap, Settings, Shell } from '@/ipc/types'
import { notify } from '@/lib/notify'

export const defaultSettings: Settings = {
  theme: 'system',
  fontFamily: '',
  fontSize: 14,
  lineHeight: 1.2,
  cursorStyle: 'bar',
  cursorBlink: true,
  scrollback: 10_000,
  copyOnSelect: false,
  defaultShell: null,
  saveQuickConnect: true,
  confirmCloseRunning: false,
}

/** Preferences, plus what this machine offers (shells, platform). */
export const useSettings = defineStore('settings', () => {
  const settings = ref<Settings>({ ...defaultSettings })
  const shells = ref<Shell[]>([])
  const systemShell = ref<string | null>(null)
  const platform = ref<string>('windows')
  const prefersDark = usePreferredDark()

  const appearance = computed<'dark' | 'light'>(() => {
    if (settings.value.theme === 'system') return prefersDark.value ? 'dark' : 'light'
    return settings.value.theme
  })

  function hydrate(bootstrap: Bootstrap) {
    settings.value = bootstrap.settings
    shells.value = bootstrap.shells
    systemShell.value = bootstrap.systemShell
    platform.value = bootstrap.platform
  }

  /** The shell a new local tab of a space uses. */
  function shellFor(spaceDefault: string | null): Shell | undefined {
    const wanted = spaceDefault ?? settings.value.defaultShell ?? systemShell.value
    return shells.value.find((shell) => shell.path === wanted) ?? shells.value[0]
  }

  function shellName(path: string | null, spaceDefault: string | null = null): string {
    const shell = path ? shells.value.find((s) => s.path === path) : shellFor(spaceDefault)
    return shell?.name ?? 'Terminal'
  }

  let saving: ReturnType<typeof setTimeout> | undefined
  function update(patch: Partial<Settings>) {
    settings.value = { ...settings.value, ...patch }
    clearTimeout(saving)
    saving = setTimeout(() => {
      api.saveSettings(settings.value).catch((cause) => {
        notify.error(`Réglages non enregistrés : ${describeError(cause)}`)
      })
    }, 300)
  }

  function reset() {
    update({ ...defaultSettings })
  }

  return {
    settings,
    shells,
    systemShell,
    platform,
    appearance,
    hydrate,
    shellFor,
    shellName,
    update,
    reset,
  }
})
