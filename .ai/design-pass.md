# Design pass — 2026-08-29

Frame agreed against the four Figma references before any code was written.
The earlier audit and rebuild is in [todo.md](todo.md).

## Palette

Stock shadcn `neutral`, copied unmodified into `src/styles.css`. Dark
`--background` is neutral-950 (`#0a0a0a`) and `--sidebar` is neutral-900
(`#171717`), which is what the mockups were drawn with. The purple accent is
gone, and so are the invented `--terminal-*` tokens.

The only saturated tokens left are `--state-online`, `--state-pending` and
`--state-offline`, used for the dot on a session row. Everything else — the
terminal palette in `src/terminal/theme.ts` included — is black, white or gray.
The shell's own ANSI output keeps its colour.

## Layout

- Open sessions left the top tab bar and now live in the sidebar, under the
  saved organization and a separator, above `+ Nouveau terminal`.
- The top bar is a toggle, a centred pill that opens the command palette, and
  split-vertical / split-horizontal / settings.
- The sidebar header shows the active workspace icon and name. The footer row is
  the workspace switcher, one button per workspace with the same icon, plus lock
  and `＋`.
- Favorites became pinned rows above the tree instead of a separate grid.
- A hidden sidebar leaves an 8 px hover strip. The peek floats **over** the
  terminal rather than pushing it, so revealing the panel never reflows xterm.

## Settings

A full page that owns the window, replacing the dialog. It has a rail with nine
searchable sections, a `Réglages / <section>` breadcrumb, a section-scoped
`Rétablir les valeurs par défaut`, and one centred column of
label + description + control rows.

Sections: Général, Apparence, Terminal, Raccourcis, Profils locaux,
Ressources SSH, Sécurité, Données, À propos. Every row is wired to real state;
there is no placeholder control.

## shadcn components pulled in

`sidebar`, `collapsible`, `breadcrumb`, `card`, `textarea`, `alert`, `popover`,
`avatar`, `toggle`, `toggle-group`, `accordion`, `skeleton`, on top of the
earlier set. Sidebar rows are `SidebarMenuButton`, `SidebarMenuAction` and
`SidebarMenuBadge`. `lucide-vue-next` was dropped in favour of the single
`@lucide/vue` set the components already use.

## Defects fixed on the way

| Defect | Effect |
| --- | --- |
| The workspace default profile had no sidebar node | Every fresh workspace looked empty although it owned a shell. Fixed in `AppData::seed` and `create_workspace`. |
| `restoreLayout` was not idempotent | Recovery plus a reload duplicated every tab and its placeholder session. Now guarded, with a regression test. |
| Terminal padding lived on `.xterm` | It overflowed its own viewport and left a permanent scrollbar in every pane. |
| xterm 6 keeps a legacy `.xterm-viewport` painted pure black | A band under the last row did not match the surface. |

## Verification

| Check | Result |
| --- | --- |
| `pnpm lint` / `typecheck` / `format:check` | clean |
| `pnpm test` | 14 passed |
| `cargo test` | 27 passed |
| `pnpm build` | clean |
| `pnpm test:smoke` | 14 passed against the running app |

The smoke check now also asserts the session list sits inside the sidebar, the
hidden sidebar leaves an 8 px strip, a peek floats over the terminal, and
settings opens as a page with a rail rather than a dialog.

## Still open

- Pointer drag-and-drop reordering in the sidebar (keyboard `Alt+↑/↓` and the
  context menu work).
- Moving a tab between windows.
- Import from a file picker; paste-and-validate is wired.
- The measured performance baseline in `docs/ACCEPTANCE.md`.
- NVDA, 200 % zoom and RTL passes.
