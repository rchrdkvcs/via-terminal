# Remote explorer — interface audit and fixes (2026-10-07)

## Scope

Screen audit (not a change review) of the remote explorer module: entry from the
title bar, normal / expanded / narrow pane, navigation, file list and selection,
toolbar actions, documents (tabs, editing, saving, conflicts, owner changes),
file dialogs (create, rename, chmod, delete, collisions, dirty close),
transfers (running, conflict, failed, completed, cancelled, skipped items),
empty / loading / disconnected / error states, keyboard and focus, light and
dark appearance, 200 % zoom.

Owned and edited: `src/components/files/*.vue` (+ new `DocumentTabs.vue`,
`FileStatus.vue`, `FileDropZone.vue`, two component tests: `DocumentTabs.test.ts`, `FileList.test.ts`),
`src/components/shell/TitleBar.vue` (explorer button only),
`.ai/remote-files-fixture.js`, this file. `Workbench.vue` was inspected and
left unchanged. Stores, IPC, Rust, composables and shared tokens were not
edited; findings that need them are listed under **Handed over**.

Stack: Vue 3.5 `<script setup>`, Tailwind v4 with project tokens
(`src/styles/tokens.css`) and material utilities (`materials.css`: `row`,
`press`, `material-control`, `material-field`), reka-ui primitives, Lucide
icons, CodeMirror 6. Conventions read: `CONTRIBUTING.md` (keyboard + visible
focus with every UI change, ~150 lines per file), `CONTEXT.md`,
`docs/ARCHITECTURE.md`, `docs/PRODUCT.md`, `docs/PRIVACY.md`,
`docs/REMOTE-FILES.md`, ADR-0009, ADR-0010. No dedicated design-system doc.

## Skills applied

`better-interface` (orchestration) with all six owners, in order:
`better-accessibility`, `better-layout`, `better-writing`,
`better-typography`, `better-colors`, `better-ui`. Motion skills
(`emil-design-eng`, `apple-design`) were not needed: no new animation was
added; existing `press` honours `prefers-reduced-motion`, the refresh spinner
keeps `motion-reduce:animate-none`.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | All owned components, accessibility tree in the preview, keyboard walk (tabs, list, dialog) | 9 findings, 8 fixed, 1 handed over |
| Layout | 1280×800, 640×400 (≈200 % zoom of 1280×800), expanded mode | 3 findings fixed |
| Writing | All French copy in owned components and dialogs they open | 4 findings fixed, 2 handed over |
| Typography | Truncation, number formatting, tabular numbers | 2 findings fixed |
| Colors | Measured contrast pairs from computed tokens, light and dark | 2 findings: 1 fixed locally, 1 handed over (shared token) |
| UI polish | Selected/active/pressed states, progress, hit areas | 3 findings fixed |

## Findings

| Severity | Domain | Location | Before | After | Why |
| --- | --- | --- | --- | --- | --- |
| HIGH | Accessibility | `stores/workbench-effects.ts:44-52` (not owned) | Watch getter returns a new `[tab.id, state]` array; every `remoteCwd` update after explorer navigation re-runs `focusTerminal` | **Handed over**: compare primitives, e.g. `` () => activeTab.value && `${activeTab.value.id}\u0000${sessions.runtime(activeTab.value.id).state}` `` | Keyboard focus is stolen from the explorer to the terminal after each folder change (verified: focus stack ends in xterm `Registry.focus` via `workbench.ts:36`) |
| HIGH | Layout | `TransferList.vue`, `FilePanel.vue`, `DocumentEditor.vue` | `max-h-40` transfers + fixed header/toolbar left the file list and editor at 0 px at 640×400; document path became a 15 px column | Transfers `max-h-[min(12rem,35%)]`, explorer column `overflow-y-auto` with `min-h-40`/`min-h-72` for list+editor, wrapping document header | Content unreachable at 200 % zoom |
| HIGH | Colors / UI | `FileList.vue`, `DocumentEditor.vue` tabs | `bg-row-selected` (#fff) on `bg-surface` (#fff) | Project `row` utility (`data-selected` → `--shadow-row` ring) | Selected rows and the active document tab were invisible in light mode |
| HIGH | Accessibility | `DocumentEditor.vue` tabs | `role="tab"` buttons, all in tab order, no arrow keys, no tabpanel, close button inside tablist | `DocumentTabs.vue`: roving `tabindex`, ←/→/Home/End, Delete closes (`aria-keyshortcuts`), `role="tabpanel"` + `aria-labelledby`, close buttons out of the tab order | Tabs pattern not operable as announced |
| HIGH | Accessibility | `FileNavigation.vue` hidden-files toggle; `TitleBar.vue` explorer button | `aria-pressed`/`aria-expanded` with no visual state | Pressed/expanded use the existing `bg-control` + `--shadow-control` treatment; Eye/EyeOff icon | State conveyed only to assistive technology |
| HIGH | Colors | `FileList.vue` headers, size, permissions | `text-ink-faint`: 2.57:1 light, 3.63:1 dark on surface | `text-ink-muted`: 5.07:1 light, 7.16:1 dark | Text contrast below 4.5:1 |
| HIGH | Colors | `FileDialog.vue` destructive button (also `shell/ConfirmDialog.vue`) | White on `--state-error` dark `#ff5f57`: 2.99:1 (light 4.65:1) | **Handed over**: add a `--destructive-foreground` token (dark ink in dark mode) via parent integration | Shared token; not changed locally |
| HIGH | Writing | `DocumentEditor.vue` conflict | Underlined text buttons “Recharger” / “Remplacer explicitement”; dialog description = path only | Real buttons “Recharger la version distante” / “Remplacer la version distante”; dialogs state the consequence; owner-changed document shows why it cannot be saved here and disables Save | Recovery and consequences were unclear; Save was offered for an old target |
| HIGH | Layout | `FileDialog.vue` | Multi-path delete description collapsed onto one line and could grow past the viewport | `whitespace-pre-line`, `max-h-[40vh] overflow-y-auto` | Destructive confirmation must identify each path; footer must stay reachable |
| MEDIUM | Accessibility | `FileList.vue` | Kind shown only by icon; focus lost after opening a folder | Hidden kind text (“dossier”, “lien symbolique”), keyboard hint via `aria-describedby`, focus moves to the first row (or the list) after navigation | Screen readers could not tell folders from files |
| MEDIUM | Accessibility | `FileList.vue` | No way to select all; selection count not announced | Header “Tout sélectionner” checkbox (indeterminate), count in the header (`role="status"`), Escape clears | Multi-select friction; count placed in the header so selecting never shifts the list |
| MEDIUM | Writing | `FileList.vue`, `FileStatus.vue` | “Ce dossier est vide.” while disconnected or when only dotfiles exist | Loading, hidden-only and disconnected states distinguished; “Connexion du terminal en cours…” while connecting; “Connecter le terminal” button | Misleading empty state |
| MEDIUM | Writing | `FileStatus.vue` | Panel error with no action | “Actualiser” and dismiss buttons next to the error | Error with no recovery |
| MEDIUM | UI | `TransferList.vue` | Green native progress, identical “Progression du fichier” labels, endless list, per-message `role="status"` | Neutral ink progress bar, bytes “3 Mo / 7 Mo”, named cancel/retry/progress, “Effacer les terminés”, one summary status, heading | Progress visible and identifiable per transfer |
| LOW | Typography | `FileList.vue`, `TransferList.vue` | `18.0 Ko`, links shown as `0 o` | `Intl.NumberFormat('fr-FR')`, “—” for non-files, full path in `title` | Locale and meaning |

## Handed over (outside owned files)

1. `stores/workbench-effects.ts:44-52` — focus theft after explorer navigation (HIGH, above).
2. Shared `--destructive-foreground` token for dark mode (HIGH, above).
3. `useFileProtection.ts:17-23` — the dirty-close dialog still offers “Enregistrer” for a document whose `owner` differs from the panel's; button labels could repeat the consequence (“Enregistrer et fermer” / “Abandonner les modifications”).
4. `useFileOperations.ts` — delete confirmation button “Supprimer” could read “Supprimer définitivement”; name/permission validation errors appear in the panel error area rather than beside the dialog field (`aria-invalid` needs the dialog to stay open, a store/dialog API change).
5. `TransferEvent` has no direction; the list cannot say “Envoi” vs “Téléchargement”. Adding `direction` to the event (or exposing the store plan) would let `TransferList` show it.
6. Cmd/Ctrl+L remains bound globally while CodeMirror has focus (already reported).

## Verification

Temporary Vite server on port 1477 (owned, stopped at the end), T3 preview tab,
sanitized fixture `.ai/remote-files-fixture.js` (`setup()` + `seed()`; host
`example.test`, user `via`, `/home/via`, no real data).

- Screenshots in `.ai/evidence/remote-files/`: `before-panel.png` (baseline),
  `after-panel-light.png`, `after-panel-dark.png` (taken before the neutral
  progress bar and the `preparing` row), `after-delete-dialog.png`,
  `after-640x400.png`, `after-expanded-disconnected.png`. The browser-only
  toast “Organisation non enregistrée” comes from the non-native preview.
- Keyboard, driven with dispatched key events in the page: document tabs ←/→/End
  move focus and selection and keep one tab stop; tabpanel labelled by the
  active tab; Enter on a folder navigates and focuses the first row (then the
  store watcher above moves focus to the terminal — reproduced, handed over);
  delete dialog opens with focus on “Annuler” and lists each path on its own line.
- Contrast measured from computed token values (canvas sRGB, WCAG formula),
  light and dark: figures in the table.
- Layout at 1280×800 normal and expanded, 640×400.
- `pnpm typecheck`: passed mid-way; at hand-off the only remaining errors (3)
  are in `useFileTransfers.ts`, which the parallel agent is migrating to the new
  `TransferPlan`/`Transfer` types. No error in the files listed above.
- `oxfmt --check` and `oxlint` on the owned files: clean.
- `pnpm exec vitest run src/components/files/DocumentTabs.test.ts src/components/files/FileList.test.ts`: 6 tests passed.

**Not verified**: real native app (Tauri) and real SFTP server; OS drag and
drop (only the `dragleave` child-crossing fix was reasoned, not driven);
screen-reader speech (accessibility tree only); forced-colors mode; title bar
tooltip for local tabs (code only); RTL; touch.

At the UI agent hand-off, two HIGH findings remained outside its owned files.
Both were resolved during parent integration, as recorded below. Native and
assistive-technology acceptance gates remain unverified.

## Parent integration follow-up

The two handed-over HIGH findings were fixed during integration. The workbench watcher now observes tab id and session state as separate primitive sources; a regression first reproduced a spurious terminal focus on remoteCwd updates, then passed after the fix. Destructive controls use a shared foreground token: white on light #d23f3a measures 4.65:1; dark #141415 on dark #ff5f57 measures 6.16:1. Hover keeps the fill/text pair stable rather than reducing opacity or replacing the destructive fill with a neutral material. Declared token contrast was computed; the rendered dark confirmation was then verified below. File-dialog field validation now exposes the store error beside the field with aria-invalid and aria-describedby.

Rendered follow-up: the dark file confirmation was checked in the T3 preview after integration; computed foreground rgb(20,20,21), background rgb(255,95,87), opacity1 matches the measured 6.16:1 pair. Capture: evidence/remote-files/after-delete-contrast.png. Transfer direction now has a visible upload/download icon, tooltip and reader label. Temporary parent Vite port1480 stopped and preview closed.

Final integration: independent review findings and parent responses are recorded in [the review follow-up](remote-files-review-followup.md). Directory refresh no longer invalidates pending document reads/reloads; late cleanup warnings remain visible on interrupted transfers. Transfer-state and dirty-document checks are shared, document/view changes use store actions, and the close-tab key is exactly Delete. Web drops explicitly recommend the native picker for executable permission preservation.
