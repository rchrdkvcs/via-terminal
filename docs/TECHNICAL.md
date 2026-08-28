# Technical architecture — V1

## System shape

- **Vue 3 + strict TypeScript** owns presentation and ephemeral view state.
- **xterm.js** renders terminals through one lifecycle-managed component, using WebGL with Canvas fallback.
- **Tauri 2 IPC** exposes validated commands for mutations and bounded channels/events for PTY output and lifecycle changes.
- **Rust** is authoritative for workspaces, persistence, process/session lifecycle, and multi-window coordination.
- **portable-pty** launches local shells and system OpenSSH.
- **SQLite** stores versioned metadata and restorable layout; Rust is its only owner.

There is one application instance and one in-memory session manager. Multiple native windows are views over that shared state. A session has at most one active terminal renderer, which is detached and reattached when a tab moves.

## Data model and invariants

Persistent records cover workspaces, resources, identities, local profiles, sidebar nodes, favorites, tabs, pane trees, per-window state, settings, and schema/application state.

- Every workspace child carries and validates its workspace ownership.
- Foreign keys and transactions reject cross-workspace references.
- Duplicate workspace creates independent identifiers and copies no secret.
- Sessions live in memory; persistence stores only descriptors safe to restore.
- Terminal contents, scrollback, history, passwords, and key material never enter SQLite.
- Layout updates are debounced and committed atomically.

## Terminal and process flow

1. Vue invokes a validated spawn command with profile/resource and workspace identifiers.
2. Rust verifies ownership, resolves the launch, creates a PTY, and returns a session identifier.
3. A dedicated reader batches bounded output to the attached renderer with backpressure.
4. Input and resize commands target the session identifier.
5. Closing requests graceful termination, then kills the process tree after a timeout.

PowerShell, CMD, and WSL are detected on Windows. Zsh is supported through detected WSL distributions. The renderer permits safe titles and links, opens URLs only through `Ctrl+click` in the system browser, and blocks remote clipboard writes by default.

## SSH

V1 starts the operating system's OpenSSH client in a PTY. Terminarr reads but never rewrites the user's SSH configuration. A resource may target an alias and apply explicit host, port, user, or identity-file overrides.

OpenSSH remains responsible for host-key prompts, `known_hosts`, keys, passphrases, and agent use. Terminarr never auto-accepts fingerprints or intercepts/stores passwords. Unexpected disconnects may retry after 1, 2, and 5 seconds before requiring manual reconnection.

## Persistence and recovery

- Migrations run transactionally at startup.
- A clean-shutdown marker distinguishes normal restoration from crash recovery.
- Crash recovery is offered, never forced, and does not replay commands or reconnect SSH automatically.
- Versioned JSON export excludes secrets and terminal content.
- Import validates first, shows an overview, assigns new identifiers, and applies transactionally.

## Security and diagnostics

- All command inputs are validated in Rust, including workspace ownership.
- Logs use structured events and redact hostnames, usernames, personal paths, commands, terminal content, and credential material.
- The optional global PIN lock uses an Argon2id verifier but is only a privacy screen; metadata remains unencrypted.
- Diagnostic export contains versions, detected capabilities, and redacted errors only.
- Tauri capabilities remain least-privilege; the frontend receives no arbitrary shell or filesystem access.

## Public command groups

The frontend consumes typed operations grouped around workspaces, resources, identities, profiles, sidebar/favorites, tabs/panes, sessions, windows, settings, import/export, lock, and recovery. Exact wire types live next to the Rust command boundary and are generated or mirrored in TypeScript; errors have stable machine codes plus safe user messages.
