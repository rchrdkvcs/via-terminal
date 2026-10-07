import type { ChangeSet } from '@codemirror/state'
/** Map CodeMirror's logical newline offsets back to the original UTF-8 text. */
function sourceOffset(source: string, position: number): number {
  let extra = 0
  for (const match of source.matchAll(/\r\n|\r|\n/g)) {
    const offset = match.index!
    if (offset - extra >= position) break
    extra += match[0].length - 1
  }
  return position + extra
}
export function newlineOf(source: string): string {
  return source.match(/\r\n|\r|\n/)?.[0] ?? '\n'
}
export function applySourceChanges(source: string, changes: ChangeSet, newline: string): string {
  const edits: { from: number; to: number; insert: string }[] = []
  changes.iterChanges((from, to, _from, _to, inserted) => {
    edits.push({
      from: sourceOffset(source, from),
      to: sourceOffset(source, to),
      insert: inserted.toString().replace(/\n/g, newline),
    })
  })
  for (const edit of edits.reverse())
    source = source.slice(0, edit.from) + edit.insert + source.slice(edit.to)
  return source
}
