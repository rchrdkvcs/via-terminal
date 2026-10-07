# Architecture

Via is a Tauri 2 application: a Rust process owns persistence, secrets and sessions; a Vue 3 interface owns organization and presentation. Terms follow [CONTEXT.md](../CONTEXT.md); decisions are in [adr/](adr/).

## Rust (`src-tauri/src`)

```text
lib.rs              composition root: builds every module once
commands/           Tauri commands, thin adapters (app, vault, sessions, files, emitter);
                    `App::shutdown` closes every session and clears staging on exit and
                    before an update
error.rs            `AppError`, the code and message every command returns
storage/            SQLite: named JSON documents and opaque blobs
secrets/            ChaCha20-Poly1305 sealing; the key comes from the OS keychain
vault/              hosts, groups, identities, keys, known hosts
  credential.rs     host credential: legacy decoding, validation, resolution, secrets to try
  resolve.rs        group inheritance of username, port, identity; a host's effective values
  connect.rs        host or typed address → connection plan
  connection_store.rs  the vault as the SSH client's store; persists a credential after authentication
layout/             persisted spaces and pinned rows, structurally validated; an unreadable or
                    invalid layout is kept aside as a backup and replaced by the default
files/              remote file service of an SSH session (`Files`)
  model.rs          wire types of the explorer
  owner.rs          endpoint/account identity checked on saves and transfers
  paths.rs          POSIX remote names versus platform-safe local names
  documents.rs      safe document replacement; reading.rs bounded UTF-8 reads
  walk.rs           recursive walk shared by uploads and downloads: completed sources,
                    remembered directories, skipped source paths, collisions, keep-both names
  upload*, download*, jobs.rs  the walk's local and remote endpoints, streamed copies, cancellation
  staging.rs        local copies of interface drops, received as raw byte chunks, cleared at
                    launch and exit
settings.rs         preferences
swipe.rs            macOS trackpad swipes over the sidebar, forwarded to switch spaces
bindings.rs         test that generates `src/ipc/bindings.ts` from the wire types (ts-rs)
sessions/           live sessions behind tabs
  local.rs          shells in a native PTY (portable-pty)
  shells.rs         `DetectedShells`: the only shells that may be launched, and the default
  io.rs             `SessionIo`, what the hub drives for either kind of session
  ssh/              embedded SSH client (russh); without a terminal size it opens no shell
    sftp.rs         the lazy SFTP service on the authenticated handle
    attempts.rs     the attempt log deciding which password, if any, is remembered
  prompts.rs        questions to the user, answered from the pane
  events.rs         output, state, prompts → `EventSink`
```

**Seams.**

- `secrets::KeySource` has the OS keychain adapter and a fixed key for tests.
- `sessions::events::EventSink` has the Tauri emitter and a recorder for tests.
- `sessions::ssh::ConnectionStore` is implemented by the vault, with a fake in the SSH tests.
- `SessionIo` covers both local and SSH sessions, so the hub never knows which one it drives.
- `files::walk::{Source, Destination}` have local and remote adapters for uploads and downloads, and an in-memory tree in the walk tests.
- `DetectedShells::new` takes a fixed shell list in tests instead of detecting the machine's.

**Rules.**

- Every vault mutation goes through `Vault::commit` or `commit_with_secrets`. Both validate a copy and persist it before publishing it. Changes to encrypted secret blobs and the vault document share one SQLite transaction, so a failed mutation keeps both unchanged. `Secrets` only seals and opens blobs; it has no write path of its own.
- Secrets never enter a document, a snapshot sent to the interface, a log or a process argument.
- The interface can only launch a detected shell, by its path, never an arbitrary executable.
- Rust owns every wire type: derive `ts_rs::TS`, list it in `bindings.rs`, regenerate with `UPDATE_BINDINGS=1 cargo test --manifest-path src-tauri/Cargo.toml bindings`. `cargo test` fails while `src/ipc/bindings.ts` is stale.

## Interface (`src`)

```text
ipc/                typed commands and events over `bindings.ts`, generated from the Rust wire types
domain/             pure logic, no Vue: organize (intents), space, split, drop, search,
                    quick-connect, credentials, limits (layout limits mirrored by Rust validation)
stores/             spaces, sessions, workbench, vault, settings, ui, updates, files (Pinia);
                    store-private parts: vault-saves, vault-inputs (records → editor inputs),
                    file-document, file-transfers; file-dialogs queues explorer questions
lib/                session routing, shortcuts, cwd reports, deferred saves
updates/            flushes durable writes and drafts before an installer runs
terminal/           xterm instances keyed by tab, outside the Vue tree
composables/        bootstrap, shortcuts, drag and drop, labels, sidebar actions, and file
                    protection (useFileProtection), every destructive intent (useClosing),
                    transfer events (useFileRuntime) and the quit request (useFileExit)
components/
  shell/            title bar, address pill, dialogs, sidebar frame and resizer
  sidebar/          rows, folders, space header and switcher
  command/          command bar
  workbench/        panes, split view, connection panel and prompts
  files/            explorer, CodeMirror documents and transfer controls; useFileOperations
                    and useFileTransfers start operations on the explorer's current connection
  page/             page frame and inspector shared by the vault and settings pages
  vault/            vault page
  settings/         settings page
  ui/               shadcn-vue primitives
```

**Organization.** `domain/organize.ts` applies one closed set of intents (open, move, remove, split, detach, resize, update a tab, navigate, folders) to a copy of a space. It returns `null` when an intent is invalid, so nothing changes; a list of intents applies all together or not at all, and `transfer` moves a row between two spaces the same way. `stores/spaces` saves the pinned part as one layout document (ADR-0008).

**Tab lifecycle.** `stores/workbench` owns complete operations for closing and replacing tabs, removing spaces, transferring rows and opening beside an existing tab. It commits organization before starting, stopping or releasing sessions, releases the explorers of the tabs it closes or retargets, owns successor focus, and exposes focus as read-only state. Compound organization intents and transfers publish only when every step succeeds. `useClosing` is the only caller of its destructive operations: each intent (close tab, replace tab, remove space, quit or update) protects explorers, confirms, closes, then offers undo, so no interface caller assembles these steps itself.

**Sessions.** `stores/sessions` subscribes to session events, maps session ids to tabs and buffers events that arrive before `open` returns. It also owns terminal input: keystrokes go to a ready session, and Enter in an exited, disconnected or failed tab reconnects it. `lib/session-routing` delivers an event only while its session is still bound to the tab, so an early exit drops the events queued after it. Renderers are keyed by tab in `terminal/registry`. Reconnecting therefore replaces the session without clearing the scrollback.

An opening attempt belongs to its tab until it succeeds or is invalidated by stop or release. A late native result is closed instead of attached; its events and errors cannot affect a replacement attempt.

The terminal registry exposes tab-level search, selection and paste operations. Its xterm instances and addons remain internal; paste still uses xterm's bracketed-paste handling.

**Vault editing.** `useDraft` validates a draft when it is saved, so an invalid version is never queued. `stores/vault-saves`, owned by the vault store (the only writer of hosts, groups and identities), saves each record one request at a time, keyed by kind and id and shared by every editor: the vault page remounts its editor on each selection, and a reopened editor queues behind the saves of the closed one. Consecutive requests from one editor coalesce into its latest draft; a failed or unanswered save does not drop the requests queued behind it, and nothing is retried unless the user asked for it. A creation is queued by its editor until it has an id; later saves of that record then queue behind it, so it is never created twice. An editor acknowledges only the version that was submitted, keeps edits made while saving dirty, clears a password only when that submitted password is still current, and shows the outcome of its latest request only. Creation drains later edits before returning the new id. Queued snapshots are saved after their editor closes, but their responses no longer change any editor. Renames from the sidebar or the group tree are patches applied to the record's latest queued version, deleting drops its waiting saves, and `vault.flush` is the single flush; replies carry the vault revision so an older one never replaces a newer view.

**Shortcuts.** `lib/shortcuts.ts` is the only list of shortcuts. Outside macOS they use Ctrl+Shift, so the shell's own Ctrl shortcuts keep working. In text fields and the document editor only navigation and global actions apply (`appliesWhileEditing`); the terminal keeps every shortcut.

**Remote files.** A docked explorer uses its SSH terminal tab's session; explorer and document tabs open their own session without a shell (ADR-0011). Each SSH actor opens one lazy SFTP service on its authenticated handle (`ssh/sftp.rs`). Opening is polled beside the shell reader, so a shell filling its channel cannot stall it; calls arriving meanwhile wait for that single attempt. The `files::Files` service answers typed requests with typed replies; transfer progress travels through `EventSink`. Atomic document replacement requires the OpenSSH extension and verified metadata. Remote names follow POSIX; only local names are checked against the platform.

The in-memory `stores/files` keeps each explorer, every transfer plan and, through `file-document`, the single document each document tab shows. That document keeps the owner of the read that produced it; after a reconnection the tab reads it again to learn the new connection's owner, and it can be saved only while both match. It reads each tab's ready session from `stores/sessions` itself and keeps one connection generation per explorer, renewed when the session changes or the explorer is released; every reply, success or failure, applies only while its generation is current. Reading an explorer never creates it. `file-transfers` holds one record per transfer, from which each explorer's list is derived; starting, staging a drop, cancelling, retrying and staging cleanup are its operations, so a released explorer is never recreated by a late reply. `useFileProtection` turns closing questions into a decision that loses nothing; `release` runs the closing, whose workbench operation releases the explorers, only while the decision is current, and asks again if a draft or transfer changed meanwhile. Quitting and updating check it again after flushing. Pinned tabs keep `remoteCwd` and their view's path, never documents. See ADR-0010 and ADR-0011.

## Testing

- **Rust**: unit tests per module, plus end-to-end SSH tests against an in-process russh server (`sessions/ssh/tests.rs`, `sftp_tests.rs`, `password_tests.rs`) and SFTP service tests against an in-process SFTP handler (`files/test_peer*.rs`). Layout tests cover loading: an unreadable layout is backed up, a missing one is created without backup. `bindings.rs` fails when `src/ipc/bindings.ts` drifts from the Rust wire types.
- **Interface**: Vitest on `domain/`, `lib/`, store lifecycle operations, asynchronous vault drafts, the terminal registry, composables (closing, file protection, quit, drag and drop, sidebar actions) and component logic (command results, space track, vault actions, a few components). Deferred native replies exercise opening/closing races; mocked renderer construction is an internal seam for registry tests. Store tests share their mocks through `stores/*.fixture.ts` (`files.fixture.ts` for the explorer); draft tests hold saves in `test/vaultSaves.ts`. `test/fixtures/credential-cases.json` is the shared table of host credential resolution, read by both `domain/credentials.test.ts` and the Rust vault tests (`vault/tests/credential_cases.rs`).
- **Real application**: `.ai/cdp-smoke.mjs` drives the running window over CDP. See `.ai/lessons.md`.
