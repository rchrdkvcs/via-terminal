import type { DroppedFile } from '@/stores/files'
interface Entry {
  name: string
  isFile: boolean
  isDirectory: boolean
  file: (success: (file: File) => void, failure: (error: DOMException) => void) => void
  createReader: () => {
    readEntries: (
      success: (entries: Entry[]) => void,
      failure: (error: DOMException) => void,
    ) => void
  }
}
export async function droppedFiles(data: DataTransfer): Promise<DroppedFile[]> {
  const result: DroppedFile[] = []
  async function walk(entry: Entry, parent = ''): Promise<void> {
    const path = parent + entry.name
    if (entry.isFile) {
      const file = await new Promise<File>((resolve, reject) => entry.file(resolve, reject))
      result.push({ file, path })
    } else if (entry.isDirectory) {
      result.push({ file: null, path })
      const reader = entry.createReader()
      while (true) {
        const entries = await new Promise<Entry[]>((resolve, reject) =>
          reader.readEntries(resolve, reject),
        )
        if (!entries.length) break
        for (const child of entries) await walk(child, path + '/')
      }
    }
  }
  const entries = [...data.items]
    .filter((item) => item.kind === 'file')
    .map((item) => item.webkitGetAsEntry?.() as Entry | null)
  if (entries.some(Boolean))
    for (const entry of entries) {
      if (entry) await walk(entry)
    }
  else for (const file of data.files) result.push({ file, path: file.name })
  return result
}
