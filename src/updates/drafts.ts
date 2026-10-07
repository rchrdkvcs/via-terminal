/** Mounted editors can save existing records or block exit for unsaved creations. */
const preparations = new Set<() => Promise<void>>()

export function registerDraftPreparation(prepare: () => Promise<void>) {
  preparations.add(prepare)
  return () => preparations.delete(prepare)
}

export async function prepareDrafts() {
  const results = await Promise.allSettled([...preparations].map((prepare) => prepare()))
  const failed = results.find((result) => result.status === 'rejected')
  if (failed?.status === 'rejected') throw failed.reason
}
