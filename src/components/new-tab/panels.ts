import type { Component } from 'vue'
import { Server, Terminal } from '@lucide/vue'
import type { TabTypeId } from '@/domain/tab-types'
import LocalTabPicker from './LocalTabPicker.vue'
import SshTabPicker from './SshTabPicker.vue'

/** The picker is independent of sidebar/tab layout. New protocols supply their
 * panel here once a corresponding session backend is implemented. */
export const tabPanels: Record<TabTypeId, { icon: Component; panel: Component }> = {
  local: { icon: Terminal, panel: LocalTabPicker },
  ssh: { icon: Server, panel: SshTabPicker },
}
