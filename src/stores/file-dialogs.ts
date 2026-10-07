import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
/** The action the user chose, or `cancel` for dismissal and any unknown value. */
export interface FileChoice<C extends string = string> {
  choice: C | 'cancel'
  value: string
  all: boolean
}
export interface FileQuestion<C extends string = string> {
  title: string
  description: string
  input?: string
  inputLabel?: string
  applyAll?: boolean
  actions: { label: string; value: C; destructive?: boolean }[]
  /** Checks the field before an action is accepted; a message keeps the question open. */
  validate?: (value: string) => string | null
}
interface Pending {
  question: FileQuestion
  resolve: (answer: FileChoice) => void
}
export const useFileDialogs = defineStore('file-dialogs', () => {
  const current = shallowRef<FileQuestion | null>(null)
  /** Validation message for the current field, shown beside it. */
  const error = shallowRef<string | null>(null)
  const queue: Pending[] = []
  let resolve: Pending['resolve'] | undefined
  function advance() {
    const next = queue.shift()
    error.value = null
    current.value = next?.question ?? null
    resolve = next?.resolve
  }
  function ask<C extends string>(question: FileQuestion<C>): Promise<FileChoice<C>> {
    return new Promise((reply) => {
      queue.push({ question, resolve: reply as Pending['resolve'] })
      if (!current.value) advance()
    })
  }
  /**
   * Accepts the presenter's raw choice; anything but an offered action cancels. Returns
   * false, keeping the question open, when its field does not validate.
   */
  function answer(value: { choice: string; value: string; all: boolean }): boolean {
    const reply = resolve
    const offered = current.value?.actions.some((action) => action.value === value.choice)
    const invalid = offered ? (current.value?.validate?.(value.value) ?? null) : null
    if (invalid) {
      error.value = invalid
      return false
    }
    current.value = null
    resolve = undefined
    reply?.({ ...value, choice: offered ? value.choice : 'cancel' })
    advance()
    return true
  }
  return { current, error, ask, answer }
})
