import { onBeforeUnmount } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { api, describeError, isNative } from '@/ipc/client'
import { on } from '@/ipc/events'
import { notify } from '@/lib/notify'
import { useSpaces } from '@/stores/spaces'
import { useSettings } from '@/stores/settings'
import { useClosing } from './useClosing'
export function useFileExit() {
  if (!isNative()) return
  const spaces = useSpaces(),
    settings = useSettings(),
    closing = useClosing()
  let stopped: (() => void) | undefined,
    exiting = false,
    pending = false
  async function request() {
    if (pending) return
    pending = true
    try {
      if (!(await closing.leave(() => Promise.all([spaces.flush(), settings.flush()])))) return
      exiting = true
      // This listener already vetoes the native close. Calling close() again only
      // reaches destroy(), and destroying the last window is vetoed once more as
      // an exit with no code. app_exit(0) is the exit that veto lets through.
      await api.exit()
    } catch (cause) {
      exiting = false
      notify.error(describeError(cause))
    } finally {
      pending = false
    }
  }
  const stopExit = on('app-exit-requested', () => {
    void request()
  })
  void getCurrentWindow()
    .onCloseRequested((event) => {
      if (exiting) return
      event.preventDefault()
      void request()
    })
    .then((unlisten) => {
      stopped = unlisten
    })
  onBeforeUnmount(() => {
    stopped?.()
    stopExit()
  })
}
