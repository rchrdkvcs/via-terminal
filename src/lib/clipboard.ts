import { notify } from './notify'

export async function copyText(
  text: string,
  done: string,
  failed = 'Impossible d’écrire dans le presse-papiers.',
): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    notify.success(done)
  } catch {
    notify.error(failed)
  }
}
