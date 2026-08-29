import {
  Boxes,
  Cloud,
  Code2,
  Cpu,
  Database,
  Folder,
  FolderOpen,
  Globe,
  HardDrive,
  House,
  Layers,
  Network,
  Server,
  Shield,
  SquareTerminal,
  Terminal,
  Wrench,
} from '@lucide/vue'
import type { Component } from 'vue'

/**
 * A workspace stores its icon as a plain string, so the set of names has to be
 * closed on this side. Anything unknown falls back to a terminal glyph rather
 * than rendering nothing.
 */
export const workspaceIcons: Record<string, Component> = {
  home: House,
  terminal: Terminal,
  server: Server,
  cloud: Cloud,
  database: Database,
  network: Network,
  shield: Shield,
  wrench: Wrench,
  code: Code2,
  cpu: Cpu,
  drive: HardDrive,
  globe: Globe,
  layers: Layers,
  boxes: Boxes,
}

export const workspaceIconNames = Object.keys(workspaceIcons)

export function workspaceIcon(name: string | undefined): Component {
  return (name && workspaceIcons[name]) || Terminal
}

/** Sidebar rows: a folder, a saved target, or a live session. */
export function nodeIcon(kind: 'folder' | 'profile' | 'resource', open = false): Component {
  if (kind === 'folder') return open ? FolderOpen : Folder
  if (kind === 'resource') return Server
  return SquareTerminal
}

export { SquareTerminal as SessionIcon }
