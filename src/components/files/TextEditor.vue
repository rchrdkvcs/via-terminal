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
import { oneDark } from '@codemirror/theme-one-dark'
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
        syntaxHighlighting(defaultHighlightStyle),
        language.of([]),
        theme.of(settings.appearance === 'dark' ? oneDark : []),
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
          '&': { height: '100%', backgroundColor: 'transparent', fontSize: '12px' },
          '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font-mono)' },
          '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
          '&.cm-focused': { outline: 'none', boxShadow: 'inset 0 0 0 1px var(--ring)' },
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
  (appearance) =>
    editor?.dispatch({ effects: theme.reconfigure(appearance === 'dark' ? oneDark : []) }),
)
onBeforeUnmount(() => editor?.destroy())
</script>
<template><div ref="host" class="h-full min-h-0 overflow-hidden" /></template>
