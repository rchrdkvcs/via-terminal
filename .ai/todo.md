# Front-end audit and rebuild — 2026-08-29

Scope: the whole Vue layer, plus the minimum Rust needed for front-end features
to work at all. Reference documents: `CONTEXT.md`, `docs/PRODUCT.md`,
`docs/TECHNICAL.md`, `docs/ACCEPTANCE.md`.

## Part 1 — Why little worked

### Broken IPC contract

| # | Defect | Effect |
| --- | --- | --- |
| 1 | `ssh_session_connect` returns `{ sessionId, resolved }`; the front read `spawned.id` | Always `undefined`, so it fell back to `crypto.randomUUID()`. **Every SSH session was invisible**: output was routed to an identifier the backend had never heard of. |
| 2 | `App.vue` listened to `session-status-changed` | Rust emits `ssh-state-changed`. No status, no reconnection feedback, no error notice ever arrived. |
| 3 | `replacementSessionId` ignored | After a successful retry the pane stayed bound to the dead PTY. |
| 4 | 18 of 28 commands never called | `tab_save`, `window_state_save`, `app_recovery_state/finish`, `settings_update`, `profile_detect`, `ssh_config_list`, `resource_create`, `identity_create`, `workspace_duplicate`, `export_create`, `import_*`, `window_create`, `ssh_session_status`, `workspace_list`. Layout persistence, recovery, settings persistence, SSH setup and import/export did not exist in the UI. |
| 5 | Front `Settings` carried `cursorStyle` and `sidebarRevealDelay`, which `domain::Settings` does not have | `settings_update` would have been rejected. Nothing persisted. |

### Performance — the source of the lag

| # | Defect | Effect |
| --- | --- | --- |
| 6 | One `listen('terminal-output')` per `TerminalView` | Every chunk was delivered to every mounted terminal, then filtered in JS. Cost scaled with pane count. |
| 7 | `Uint8Array.from(binary, (c) => c.charCodeAt(0))` | A JS callback per byte on every 8 KiB chunk. This was the dominant cost under sustained output. |
| 8 | One `terminal.write()` per IPC message | No coalescing; each write scheduled its own render. |
| 9 | `screenReaderMode: true` unconditionally | xterm maintained a live DOM mirror of the viewport at all times. |
| 10 | `fit()` called synchronously inside `ResizeObserver` | Re-entered layout; splitter drags produced observer loops and one IPC `session_resize` per frame. |
| 11 | `@import url('https://fonts.googleapis.com/...')` in `styles.css` | Blocked by the app CSP, a render-blocking network attempt at startup, and a violation of "works fully offline". |
| 12 | No `contain` on the terminal host | xterm's constant repaints invalidated the surrounding layout. |

### Lifecycle and state

| # | Defect | Effect |
| --- | --- | --- |
| 13 | `TerminalView` created and disposed xterm on every tab switch | **Scrollback was destroyed on each switch** and the PTY kept writing into a disposed instance. Directly contradicts TECHNICAL.md ("detached and reattached when a tab moves"). |
| 14 | Output arriving before the pane mounted was dropped | The shell banner was frequently missing. |
| 15 | `activeTabId` was global, not per workspace | After switching workspace it pointed at another workspace's tab: empty screen or the wrong terminal. |
| 16 | `closeTab` indexed `visibleTabs` with an index from the unfiltered `tabs` array | Wrong tab selected after a close. |
| 17 | `switchWorkspace` rebuilt the tree from the snapshot | Wiped `node.sessions`, so open-session badges vanished. |
| 18 | Splits limited to two panes; `PaneTree` from the backend unused | Layout could never round-trip. |
| 19 | `window.prompt` / `window.confirm` | Blocking native dialogs inside a WebView. |
| 20 | Local shells never reported exit | `session_spawn` used `spawn()` with a no-op exit hook; a finished shell looked identical to a live one. |

### Interface

| # | Defect | Effect |
| --- | --- | --- |
| 21 | Command palette: no arrow-key navigation, Enter always ran `actions[0]` | Not keyboard-complete (ACCEPTANCE requires it). |
| 22 | Dialogs: no focus trap, no focus restore, no Escape on settings | Fails WCAG 2.2 AA. |
| 23 | `theme: 'system'` never resolved; no `.theme-light` rules existed | The light theme did nothing. |
| 24 | Clicking an open favorite did nothing | PRODUCT.md asks it to focus the existing session. |
| 25 | `sidebarRevealDelay` unused; reveal fired on `mouseenter` | Sidebar flashed open when the pointer crossed the edge. |
| 26 | Shortcuts fired while locked and behind open dialogs | The lock screen drove the workspace behind it. |
| 27 | Notices accumulated forever, no auto-dismiss | |
| 28 | No Tailwind, no component library | 720 lines of hand-written CSS with no tokens. |

### Backend gaps that made front-end features impossible

| # | Gap | Effect |
| --- | --- | --- |
| 29 | `capabilities/default.json` scoped to `windows: ["main"]` | Every `invoke()` from a secondary window failed. Multi-window was dead on arrival. |
| 30 | No command to create a local profile | Only the seeded PowerShell profile could ever exist. |
| 31 | No sidebar-node or favorite CRUD | Creating, renaming, moving, deleting and pinning could not be persisted. Newly created resources never appeared in the tree. |
| 32 | `PaneTree` serialised `session_id` in snake_case | `#[serde(rename_all)]` renames variants, not struct-variant fields, so one type broke the camelCase wire convention. |

## Part 2 — What was built

### Foundations

- **Tailwind CSS v4** (`@tailwindcss/vite`) with an OKLCH token set in
  `src/styles.css`; `:root` light, `.dark` dark, per shadcn convention.
- **shadcn-vue** (new-york, reka-ui): button, input, label, separator,
  scroll-area, tooltip, dialog, dropdown-menu, command, badge, switch, slider,
  select, tabs, sonner.
- `@/*` path alias in `tsconfig.json`, `vite.config.ts` and `vitest.config.ts`.
- No webfont; the CSP-safe system stack is used instead.

### IPC layer (`src/ipc/`)

- `types.ts` mirrors every Rust wire type exactly.
- `client.ts` wraps all 35 commands with real signatures.
- `events.ts` registers **one** native listener per event name and fans out in JS.

### Terminal engine (`src/terminal/registry.ts`)

Owns every xterm instance outside the Vue tree, keyed by session id.

- Renderers are **detached and reattached**, never rebuilt: scrollback survives
  tab switches, splits and window moves.
- Single output subscription; indexed base64 decode; chunks coalesced and
  written once per animation frame.
- Output arriving before a pane mounts is buffered and drained on attach.
- `rebind(previous, next)` follows an SSH retry onto its replacement PTY.
- `fit()` deferred to the next frame; `session_resize` only on a real change.
- WebGL with `onContextLoss` fallback to the DOM renderer.
- Unicode 11 width tables; `Ctrl+click` links open in the system browser.
- `screenReaderMode` off by default, switchable in settings.

### Store (`src/stores/app.ts`)

Recursive `PaneNode` tree matching the backend `PaneTree`, per-workspace active
tab, sessions keyed by target, debounced layout and settings persistence,
`restorable` placeholders for restored panes, bounded-retry SSH handling and
manual reconnect.

### Interface

`AppSidebar` + `SidebarTree`, `TabBar`, `PaneLayout` (recursive splits with a
keyboard-operable separator), `TerminalPane`, `CommandPalette` (reka-ui Listbox:
arrow keys, type-ahead, Enter), `SettingsDialog`, `TargetDialog` (local profile /
SSH resource, prefilled from `ssh_config_list`), `LockScreen`, `TerminalSearch`,
recovery and close-confirmation dialogs, toasts via vue-sonner.

Applied from the layout / UI skills: logical properties throughout, 2× gap ratio
between groups, concentric radii, `scale(0.96)` on press, named transition
properties at 150 ms, transitions suppressed for one frame on theme switch,
1.5 px icon stroke beside regular text, a static cue beside every animated one.

### Rust changes (minimum needed)

- `profile_create`, `sidebar_node_create/rename/move/delete`, `favorite_set`,
  `tab_delete` commands and service methods, with cascading deletion that keeps
  the snapshot valid in one transaction.
- `session_spawn` now emits `session-exited`.
- `PaneTree` gains `rename_all_fields = "camelCase"`.
- `capabilities/default.json` covers `window-*` and grants `opener:allow-open-url`.

## Part 3 — Verification

- `pnpm typecheck` — clean
- `pnpm lint` — clean
- `pnpm test` — 14 passed
- `pnpm build` — clean; xterm split into its own chunk (424 kB shell + 501 kB xterm)
- `cargo test` — 27 passed (7 new)
- `node .ai/cdp-smoke.mjs` against the running app — 8 passed: boot, renderer
  attach, session registration, PTY prompt, typed-input round trip, split with
  preserved scrollback, scrollback across a tab switch, no runtime errors.

## Part 4 — Not done

- Drag-and-drop reordering in the sidebar (keyboard `Alt+Up`/`Alt+Down` and the
  context menu are implemented; pointer dragging is not).
- Moving a tab between windows. Rust owns the sessions and the renderer registry
  supports detach/reattach, but no cross-window handoff command exists yet.
- Import from a file picker; only export-to-clipboard is wired.
- A measured performance baseline (`docs/ACCEPTANCE.md` "Performance reference").
- NVDA, 200 % zoom and RTL passes.
