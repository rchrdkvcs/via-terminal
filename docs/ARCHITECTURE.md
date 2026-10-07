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
files/              lazy SFTP, safe document replacement, streamed transfers and drop staging
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

- Every vault mutation goes through `Vault::commit` or `commit_with_secrets`. Both validate a copy and persist it before publishing it. Changes to encrypted secret blobs and the vault document share one SQLite transaction, so a failed mutation keeps both unchanged. `Secrets` only seals and opens blobs; it has no write path of its own.
- Secrets never enter a document, a snapshot sent to the interface, a log or a process argument.
- The interface can only launch a detected shell, by its path, never an arbitrary executable.

## Interface (`src`)

```text
ipc/                typed commands and events, mirrors of the Rust wire types
domain/             pure logic, no Vue: organize (intents), split, drop, search, quick-connect, palette
stores/             spaces, sessions, workbench, vault, settings, ui (Pinia), and the
                    store-private parts of sessions (session-events) and workbench
                    (workbench-opening, -lifecycle, -effects)
terminal/           xterm instances keyed by tab, outside the Vue tree
composables/        bootstrap, shortcuts, drag and drop, labels, sidebar actions
components/
  shell/            title bar, address pill, dialogs, sidebar frame and resizer
  sidebar/          rows, folders, space header and switcher
  command/          command bar
  workbench/        panes, split view, connection panel and prompts
  files/            explorer, CodeMirror documents and transfer controls
  vault/            vault page
  settings/         settings page
  ui/               shadcn-vue primitives
```

**Organization.** `domain/organize.ts` applies one closed set of intents (open, move, remove, split, detach, resize, folders, rename) to a copy of a space. It returns `null` when an intent is invalid, so nothing changes; a list of intents applies all together or not at all, and `transfer` moves a row between two spaces the same way. `stores/spaces` saves the pinned part as one layout document (ADR-0008).

**Tab lifecycle.** `stores/workbench` owns complete operations for closing tabs, removing spaces, transferring rows and opening beside an existing tab. It commits organization before starting or releasing sessions, owns successor focus, and exposes focus as read-only state. Compound organization intents and transfers publish only when every step succeeds. Confirmations and undo notifications remain in the interface's presentation code; their callers do not orchestrate runtime cleanup.

**Sessions.** `stores/sessions` maps session ids to tabs and buffers events that arrive before `open` returns. `lib/session-routing` delivers an event only while its session is still bound to the tab, so an early exit drops the events queued after it. Renderers are keyed by tab in `terminal/registry`. Reconnecting therefore replaces the session without clearing the scrollback.

An opening attempt belongs to its tab until it succeeds or is invalidated by stop or release. A late native result is closed instead of attached; its events and errors cannot affect a replacement attempt.

The terminal registry exposes tab-level search, selection and paste operations. Its xterm instances and addons remain internal; paste still uses xterm's bracketed-paste handling.

**Vault editing.** `useDraft` validates a draft when it is saved, so an invalid version is never queued. `components/vault/saveQueue` saves each record one request at a time, keyed by kind and id and shared by every editor: the vault page remounts its editor on each selection, and a reopened editor queues behind the saves of the closed one. Consecutive requests from one editor coalesce into its latest draft; a failed or unanswered save does not drop the requests queued behind it, and nothing is retried unless the user asked for it. A creation is queued by its editor until it has an id; later saves of that record then queue behind it, so it is never created twice. An editor acknowledges only the version that was submitted, keeps edits made while saving dirty, clears a password only when that submitted password is still current, and shows the outcome of its latest request only. Creation drains later edits before returning the new id. Queued snapshots are saved after their editor closes, but their responses no longer change any editor.

**Shortcuts.** `lib/shortcuts.ts` is the only list of shortcuts. Outside macOS they use Ctrl+Shift, so the shell's own Ctrl shortcuts keep working.

## Testing

- **Rust**: unit tests per module, plus an end-to-end SSH test against an in-process russh server (`sessions/ssh/tests.rs`).
- **Interface**: Vitest on `domain/`, `lib/`, store lifecycle operations, asynchronous vault drafts and the terminal registry. Deferred native replies exercise opening/closing races; mocked renderer construction is an internal seam for registry tests. Store tests share their mocks through `stores/*.fixture.ts`; draft tests hold saves in `test/vaultSaves.ts`.
- **Real application**: `.ai/cdp-smoke.mjs` drives the running window over CDP. See `.ai/lessons.md`.

**Remote files.** Each SSH actor opens one lazy SFTP channel on its authenticated handle. The `files::Files` service handles typed requests; transfer progress travels through `EventSink`. Atomic document replacement requires the OpenSSH extension and verified metadata. The in-memory `stores/files` keeps per-tab drafts and generation guards against stale replies. Closing presentation paths use `useFileProtection`; native window closure and application quit use the same guard. Pinned tab layout retains only `remoteCwd`, never documents. See ADR-0009 and ADR-0010.
