import { expect, it, vi } from 'vitest'
import { deferredSave } from './deferred-save'

it('flushes the newest snapshot after a write already in progress', async () => {
  let value = 'first'
  const stored: string[] = []
  let finish!: () => void
  const save = deferredSave(
    () => value,
    async (input) => {
      stored.push(input)
      if (input === 'first')
        await new Promise<void>((resolve) => {
          finish = resolve
        })
    },
    vi.fn(),
    300,
  )
  save.schedule()
  const flushing = save.flush()
  value = 'second'
  save.schedule()
  finish()
  await flushing
  expect(stored).toEqual(['first', 'second'])
})

it('keeps a failed snapshot pending so installation can retry the save', async () => {
  const write = vi.fn().mockRejectedValueOnce(new Error('disk full')).mockResolvedValue(undefined)
  const save = deferredSave(() => 'important changes', write, vi.fn(), 300)
  save.schedule()
  await expect(save.flush()).rejects.toThrow('disk full')
  await expect(save.flush()).resolves.toBeUndefined()
  expect(write.mock.calls.map(([input]) => input)).toEqual([
    'important changes',
    'important changes',
  ])
})
