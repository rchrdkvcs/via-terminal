import type { Size } from '@/ipc/types'
import type { Instance } from './create'

const MAX = 1000

export function proposedSize(instance: Instance): Size | null {
  if (!instance.container.isConnected) return null
  const proposed = instance.fit.proposeDimensions()
  if (!proposed || !Number.isFinite(proposed.cols) || !Number.isFinite(proposed.rows)) return null
  if (proposed.cols < 2) return null
  return {
    cols: Math.min(proposed.cols, MAX),
    rows: Math.min(Math.max(proposed.rows, 1), MAX),
  }
}

export function fitNow(instance: Instance): Size | null {
  const size = proposedSize(instance)
  if (size) instance.terminal.resize(size.cols, size.rows)
  return size
}

export const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))
