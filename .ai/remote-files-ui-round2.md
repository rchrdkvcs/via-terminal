# Remote files UI — round 2

Scope: the remote explorer surface (`src/components/files/*`), its boundary in
`Workbench.vue`, and the shared tokens it depends on (`src/styles/tokens.css`).
No SFTP logic, store, protection, transfer or Rust change.

Sources read: `better-interface` and its six domain skills, CONTRIBUTING,
CONTEXT, `styles/{tokens,materials,index}.css`, the `Button`, `Input`, `Switch`,
`ResizableHandle` and alert-dialog primitives, and the surfaces that already
work well (`PageShell` rail, sidebar `row`, `TitleBar`, `SettingChoice`,
`ConfirmDialog`).

## Findings (consolidated) and fixes

| # | Sev | Finding (measured) | Root cause | Fix |
| --- | --- | --- | --- | --- |
| 1 | HIGH | Dark mode: checkboxes render white with system blue. Computed `color-scheme: normal`, `accent-color: auto` on `html`, row checkbox and header checkbox. | No `color-scheme` anywhere in the app, so every native control (checkbox, scrollbars, progress) used light rendering. | `tokens.css`: `color-scheme: light` on `:root`, `dark` on `.dark`, `accent-color: var(--accent-fill)`. After: `scheme: dark`, `accent: rgb(236,236,238)`. Also covers the dialog's "Appliquer aux autres conflits" checkbox. |
| 2 | HIGH | No boundary between terminal and explorer: resize handle `bg: rgba(0,0,0,0)`, explorer `bg-surface` = terminal surface. | Handle inherits the transparent split-view style; panel used the same surface. | Explorer uses the Via rail tone (`bg-rail`, like `PageShell`); handle draws a full-height `bg-hairline` (after: `rgba(255,255,255,0.07)` dark). Same hairline on the list/editor handle. |
| 3 | HIGH | Selected row drawn with `border-radius`/`box-shadow` on `<tr>`. Works in Chromium, not reliable in WebKit (Tauri macOS/Linux). | Table semantics used for a selectable row list. | `FileList` now ARIA `table/rowgroup/row/columnheader/cell` on CSS-grid rows, so the shared `row` utility (radius 8px, `--row-selected`, `--shadow-row`) applies to a real box. Container-query columns kept (16rem / 20rem). |
| 4 | MEDIUM | Buttons hand-built in 6 files with 4 sizes (24/28/32px), 3 radii (4/6/8px), 2 focus styles (outline vs ring), 3 disabled opacities (.3/.4/.45). | `Button` primitive not used. | All explorer buttons use `Button` (`ghost icon-sm` 28px toolbar/nav, `ghost icon-xs` row actions, `secondary xs` inline actions, `default sm` for the single "Connecter le terminal" CTA). Focus = primitive ring, disabled = `.45`. |
| 5 | MEDIUM | Dialog buttons were raw `<button>` with `py-2 text-sm`; differ from `ConfirmDialog`. | Same as 4. | `FileDialog`: `Button secondary` cancel, `default`/`destructive`/`secondary` actions, `Input` primitive for name/path (mono). Destructive pair re-measured: bg `rgb(255,95,87)` / fg `rgb(20,20,21)` (6.16:1, unchanged). |
| 6 | MEDIUM | Editor in dark had One Dark's blue-grey background and active line, foreign to Via neutrals. | `oneDark` full theme. | `TextEditor`: keep only `oneDarkHighlightStyle` for syntax; background transparent on `--surface`, gutter `--ink-faint`, active line `--row-hover`, caret `--ink`. Focus ring kept (`--ring`). |
| 7 | MEDIUM | Editor area not delimited from the list/transfers. | Same surface everywhere, only `border-t`. | Document tab strip on rail, tab panel on `--surface` (document = content surface); path/conflict/stale bars separated by hairlines. |
| 8 | MEDIUM | Icon stroke 2px and sizes 12/14/15 mixed, while title bar uses 1.5px. | Lucide defaults. | `stroke-width="1.5"` everywhere in the surface; sizes from the primitive (16px in 28px, 14px in 24px). |
| 9 | MEDIUM | Row keyboard focus ring drew around the name cell only (checkbox outside). | Ring on inner button. | Ring on the row via `has-[button:focus-visible]` (computed 2px ring at 22% ink). |
| 10 | MEDIUM | At 640×400 the path field shrinks to 38px. | Single non-wrapping row. | Path row is a container: below 16rem the field takes its own full line. |
| 11 | LOW | Three bars had uneven padding (px-3 / px-2 / px-4) and heights (40/48/45). | Ad hoc spacing. | Header `ps-3 pe-2`, nav + operations grouped (`pt-2` / `pt-1 pb-2`), transfers header `h-9 ps-3 pe-2`, document bar `ps-3 pe-2`. |
| 12 | LOW | Tabs: inactive and active text same colour; close button 4px radius in 8px tab. | — | Inactive tabs `text-ink-muted`, close uses `Button icon-xs` (5px radius, primitive). |

Not changed on purpose: neutral `--row-selected` (Via selection language, same
as sidebar and settings rail); checkbox stays native (platform control, now
themed). Parent integration keeps the retry explanation on a wrapper, so hovering its
area still explains why the primitive button is disabled.

## Evidence (`.ai/evidence/remote-files/`)

- Before: `ui-round2-before-light.png`, `ui-round2-before-dark.png` (white/blue
  checkboxes, no boundary, blue editor).
- After: `ui-round2-after-light.png`, `ui-round2-after-dark.png`,
  `ui-round2-after-dialog-dark.png` (delete confirmation),
  `ui-round2-after-640x400-dark-focus.png` (narrow + keyboard focus row),
  `ui-round2-after-expanded-light-hover.png` (expanded + toolbar hover).

All with two rows multi-selected (header checkbox indeterminate), two dirty
documents, one conflict and every transfer state.

## Verification

- Owned Vite on port 1481 + T3 preview tab, fixture `.ai/remote-files-fixture.js`
  (`via@example.test`, `/home/via`). Computed styles read with
  `getComputedStyle` before and after (values above). Light and dark,
  1280×800 normal and expanded, 640×400. Server stopped, preview closed.
- `pnpm typecheck`, `pnpm lint`, `pnpm format:check`: pass.
  `pnpm test`: 39 files, 220 tests pass (FileList test selectors updated to the
  ARIA roles; behaviour unchanged). `vite build`: pass.

**Not verified**: the Tauri webview (WebKit on macOS/Linux, WebView2 on
Windows) — only Chromium preview; native checkbox rendering with
`accent-color` in WebKit/GTK; OS drag and drop, native pickers, screen readers;
hover on a real trackpad.

## Parent integration

- Reproduced the initial `100%, 40%` layout warning in the preview. Reka registers a snapshot of initial constraints, so the terminal's conditional default of 100 was reused after the second panel mounted. The terminal now takes the remaining space (only the explorer declares 40). The same pattern was removed from the list/editor split, where the editor declares 60.
- Fresh load and hide/reopen now report no layout warnings and measure 60/40. Expansion hides the terminal visually while keeping it mounted; restore returns the split.
- Dark scheme/accent confirmed in the preview, syntax spans retain One Dark colours without its background. Final integration capture: `ui-round2-after-integration-dark.png` (narrower preview host than the agent's desktop captures).
- Typecheck, lint, all 220 frontend tests and production build pass after integration. Existing build chunk/import warnings and jsdom canvas diagnostics remain.
- Temporary parent Vite port 1482 and preview were stopped after verification.
