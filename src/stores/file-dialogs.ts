import { defineStore } from 'pinia'
import { shallowRef } from 'vue'
export interface FileChoice {
  choice: string
  value: string
  all: boolean
}
export interface FileQuestion {
  title: string
  description: string
  input?: string
  inputLabel?: string
  applyAll?: boolean
  actions: { label: string; value: string; destructive?: boolean }[]
}
export const useFileDialogs = defineStore('file-dialogs', () => {
  const current = shallowRef<FileQuestion | null>(null)
  const queue: { question: FileQuestion; resolve: (answer: FileChoice) => void }[] = []
  let resolve: ((answer: FileChoice) => void) | undefined
  function advance() {
    const next = queue.shift()
    current.value = next?.question ?? null
    resolve = next?.resolve
  }
  function ask(question: FileQuestion): Promise<FileChoice> {
    return new Promise((reply) => {
      queue.push({ question, resolve: reply })
      if (!current.value) advance()
    })
  }
  function answer(value: FileChoice) {
    const reply = resolve
    current.value = null
    resolve = undefined
    reply?.(value)
    advance()
  }
  return { current, ask, answer }
})
