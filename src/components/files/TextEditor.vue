<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Compartment, EditorState } from '@codemirror/state'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  LanguageDescription,
} from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import { oneDarkHighlightStyle } from '@codemirror/theme-one-dark'
import { applySourceChanges, newlineOf } from './sourceText'
import { documentSaveKey } from '@/lib/shortcuts'
import { useSettings } from '@/stores/settings'
const props = defineProps<{ content: string; path: string }>()
const emit = defineEmits<{ change: [content: string]; save: [] }>()
const host = ref<HTMLElement>()
const settings = useSettings()
const theme = new Compartment(),
  language = new Compartment()
let editor: EditorView | undefined
let source = props.content
let replacing = false
let newline = newlineOf(source)
const highlight = (appearance: 'dark' | 'light') =>
  syntaxHighlighting(appearance === 'dark' ? oneDarkHighlightStyle : defaultHighlightStyle)
async function loadLanguage() {
  const support = LanguageDescription.matchFilename(languages, props.path)
  const extension = support ? await support.load() : []
  editor?.dispatch({ effects: language.reconfigure(extension) })
}
onMounted(() => {
  editor = new EditorView({
    parent: host.value,
    state: EditorState.create({
      doc: props.content,
      extensions: [
        lineNumbers(),
        history(),
        drawSelection(),
        highlightActiveLine(),
        language.of([]),
        theme.of(highlight(settings.appearance)),
        keymap.of([
          {
            key: documentSaveKey,
            run: () => {
              emit('save')
              return true
            },
          },
          ...defaultKeymap,
          ...historyKeymap,
        ]),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !replacing) {
            source = applySourceChanges(source, update.changes, newline)
            emit('change', source)
          }
        }),
        EditorView.contentAttributes.of({
          'aria-label': `Éditer ${props.path}`,
          spellcheck: 'false',
        }),
        EditorView.theme({
          '&': {
            height: '100%',
            backgroundColor: 'transparent',
            color: 'var(--surface-ink)',
            fontSize: '12px',
          },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
          '.cm-content': { caretColor: 'var(--ink)' },
          '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--ink)' },
          '.cm-gutters': {
            backgroundColor: 'transparent',
            color: 'var(--ink-faint)',
            border: 'none',
          },
          '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--row-hover)' },
          '.cm-activeLineGutter': { color: 'var(--ink-muted)' },
          '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
            backgroundColor: 'rgb(127 127 127 / 30%)',
          },
          '&.cm-focused': { outline: 'none' },
        }),
      ],
    }),
  })
  void loadLanguage()
})
watch(
  () => props.content,
  (content) => {
    if (editor && content !== source) {
      source = content
      newline = newlineOf(source)
      replacing = true
      editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: content } })
      replacing = false
    }
  },
)
watch(
  () => settings.appearance,
  (appearance) => editor?.dispatch({ effects: theme.reconfigure(highlight(appearance)) }),
)
onBeforeUnmount(() => editor?.destroy())
</script>
<template><div ref="host" class="h-full min-h-0 overflow-hidden" /></template>
