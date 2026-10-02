# Architecture

Via is a Tauri 2 application: a Rust process owns persistence, secrets and sessions; a Vue 3 interface owns organization and presentation. Terms follow [CONTEXT.md](../CONTEXT.md); decisions are in [adr/](adr/).

## Rust (`src-tauri/src`)

```text
lib.rs              composition root: builds every module once
commands/           Tauri commands, thin adapters (app, vault, sessions, emitter)
storage/            SQLite: named JSON documents and opaque blobs
secrets/            ChaCha20-Poly1305 sealing; the key comes from the OS keychain
vault/              hosts, groups, identities, keys, known hosts
  resolve.rs        inheritance of username, port, identity, key
  connect.rs        host or typed address → connection plan
  trust.rs          the vault as the SSH client's store
layout/             persisted spaces and pinned rows, structurally validated
settings.rs         preferences
sessions/           live sessions behind tabs
  local.rs          shells in a native PTY (portable-pty)
  shells.rs         detected shells; only these may be launched
  ssh/              embedded SSH client (russh)
  prompts.rs        questions to the user, answered from the pane
  events.rs         output, state, prompts → `EventSink`
```

**Seams.**

- `secrets::KeySource` has the OS keychain adapter and a fixed key for tests.
- `sessions::events::EventSink` has the Tauri emitter and a recorder for tests.
- `sessions::ssh::ConnectionStore` is implemented by the vault, with a fake in the SSH tests.
- `SessionIo` covers both local and SSH sessions, so the hub never knows which one it drives.

**Rules.**

- Every vault mutation goes through `Vault::commit`, which validates a copy, persists it, then publishes it.
- Secrets never enter a document, a snapshot sent to the interface, a log or a process argument.
- The interface can only launch a detected shell, by its path, never an arbitrary executable.

## Interface (`src`)

```text
ipc/                typed commands and events, mirrors of the Rust wire types
domain/             pure logic, no Vue: organize (intents), split, drop, search, quick-connect, palette
stores/             spaces, sessions, workbench, vault, settings, ui (Pinia)
terminal/           xterm instances keyed by tab, outside the Vue tree
composables/        bootstrap, shortcuts, drag and drop, labels, sidebar actions
components/
  shell/            window frame, dialogs, sidebar frame and resizer
  sidebar/          address pill, rows, folders, space header and switcher
  command/          command bar
  workbench/        panes, split view, connection panel and prompts
  vault/            vault page
  settings/         settings page
  ui/               shadcn-vue primitives
```

**Organization.** `domain/organize.ts` applies one closed set of intents (open, move, remove, split, detach, resize, folders, rename) to a copy of a space. It returns `null` when an intent is invalid, so nothing changes. `stores/spaces` saves the pinned part as one layout document (ADR-0008).

**Sessions.** `stores/sessions` maps session ids to tabs and buffers events that arrive before `open` returns. Renderers are keyed by tab in `terminal/registry`. Reconnecting therefore replaces the session without clearing the scrollback.

**Shortcuts.** `lib/shortcuts.ts` is the only list of shortcuts. Outside macOS they use Ctrl+Shift, so the shell's own Ctrl shortcuts keep working.

## Testing

- **Rust**: unit tests per module, plus an end-to-end SSH test against an in-process russh server (`sessions/ssh/tests.rs`).
- **Interface**: Vitest on `domain/`, `lib/` and the pure helpers of `vault/` and `settings/`.
- **Real application**: `.ai/cdp-smoke.mjs` drives the running window over CDP. See `.ai/lessons.md`.
