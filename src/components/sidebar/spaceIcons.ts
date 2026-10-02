import {
  Briefcase,
  Building2,
  Cloud,
  Code,
  Database,
  FlaskConical,
  Globe,
  House,
  Server,
  Shield,
  Terminal,
  Wrench,
} from '@lucide/vue'
import type { Component } from 'vue'

/** Lucide components for the icon names a space can store. */
export const spaceIconComponents: Record<string, Component> = {
  terminal: Terminal,
  server: Server,
  briefcase: Briefcase,
  house: House,
  cloud: Cloud,
  database: Database,
  shield: Shield,
  'flask-conical': FlaskConical,
  'building-2': Building2,
  globe: Globe,
  code: Code,
  wrench: Wrench,
}

export function spaceIcon(name: string): Component {
  return spaceIconComponents[name] ?? Terminal
}
