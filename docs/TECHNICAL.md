# Technical architecture — V1

## System shape

- Vue 3 with strict TypeScript owns presentation and ephemeral interaction state.
- xterm.js renders terminals through lifecycle-managed panes with WebGL and Canvas fallback.
- Tauri 2 IPC exposes typed, validated commands and bounded events.
- Rust is authoritative for workspaces, tabs, sidebar organization, persistence, sessions, and multi-window coordination.
- portable-pty launches local shells and system OpenSSH.
- SQLite stores versioned durable metadata and pinned layouts; Rust is its only owner.

There is one application instance and one in-memory session manager. A tab has at most one terminal renderer, detached and reattached rather than recreated when moved.

## Canonical sidebar model

The frontend never owns a mutable copy of the canonical tree. It renders projections and submits intentions. Ephemeral drag state may live in Vue, but a validated Rust mutation is the only authority that can change ownership, order, folder membership, pinned status, split membership, or window placement.

The new model replaces the pre-release sidebar model outright. No migration, compatibility adapter, feature flag, or repair-on-render path is required. Development data may be reset.

Persistent records cover:

- workspaces and ordered workspace icons;
- default profiles, resources, and identities;
- tabs and their unique workspace and window ownership;
- pinned locations and one-level folders;
- pinned split trees;
- window and sidebar state;
- settings and schema state.

Runtime records cover:

- temporary tabs;
- sessions and process handles;
- renderer attachment;
- focused tabs;
- drag previews and pending intents.

## Required invariants

After every committed mutation:

- each tab identifier appears exactly once in its window projection;
- every tab owns exactly one session descriptor and pane;
- a tab belongs to exactly one workspace and one window;
- a tab is in exactly one pinned or temporary location;
- a tab belongs to at most one folder and one split group;
- folders belong to one workspace, exist only in the pinned area, and never nest;
- split groups contain two to four members;
- split members are contiguous and share workspace, window, pinned status, and folder or root location;
- existing split groups never merge;
- cross-workspace ownership references are rejected.

Invariant validation runs at the command boundary and in tests. The UI must not attempt to repair invalid state during rendering.

## Mutations and concurrency

Every sidebar operation is a typed transaction over identifiers:

1. the frontend submits source, target, operation, and observed state version;
2. Rust validates identity, ownership, target grammar, group limits, and version;
3. Rust calculates the complete next state without mutating the current state;
4. the transaction persists atomically when durable data changes;
5. the in-memory state swaps once;
6. a versioned event updates all windows.

Invalid or stale operations return a stable error and make no change. Backend serialization resolves simultaneous window mutations. An obsolete frontend refreshes from the authoritative snapshot; orders are not heuristically merged.

Local reorder may render optimistically when it has an exact inverse. Cross-workspace transfer and dependency-sensitive operations wait for backend validation. Undo submits a new inverse command against the same identifiers; it does not restore serialized copies.

Rapid durable reorders may be debounced briefly, but only complete transactions reach SQLite. An in-progress drag has no persistent representation.

## Sidebar projection and drag

Vue derives pinned roots, folder children, temporary rows, and contiguous group decoration from one versioned snapshot. Components receive identifiers and display data, not independently mutable tab objects.

Drag code produces one intent from a closed grammar: before, after, into-folder, pin, unpin, split-left, split-right, split-top, split-bottom, or workspace-reorder. Target detection is separate from domain mutation. No drop handler splices multiple frontend arrays.

A drag begins after the movement threshold. Preview, auto-scroll, and cancellation are ephemeral. Escape, focus loss, stale versions, invalid targets, group-to-group targets, and excess split members discard the intent.

## Session and renderer lifecycle

A tab and session are one-to-one. Rust resolves the tab configuration, spawns one PTY, and binds its session identifier. A dedicated reader batches bounded output with backpressure. Input and resize target that identifier.

Sidebar moves, pin changes, folders, workspace switches, and split changes never spawn, kill, or clone a PTY. Moving between windows detaches the single renderer and attaches it in the target window without duplicating output.

Stopping requests graceful termination, then kills the process tree after a timeout. A successful temporary exit removes its runtime tab. Launch failure or unexpected disconnect keeps an inspectable error tab. Stopping a favorite preserves its durable descriptor.

Split layout is an ordered horizontal or vertical tree whose leaves are tab identifiers. Only pinned split trees persist. A tree below two leaves is removed.

## Workspace isolation and transfer

Every workspace child carries and validates workspace ownership. Foreign keys and transactions reject cross-workspace references. Transfer is an explicit command, never a drag target.

Transfer this tab may detach one split member first. Transfer group validates every member and dependency before changing anything. Any invalid resource or identity rejects the whole transfer. No folder transfers implicitly.

## Persistence and restoration

Persist only durable organization:

- workspaces, resources, identities, profiles, folders, favorites, names, ordering;
- pinned split trees;
- disclosure state;
- window geometry, active workspace, sidebar width and visibility;
- safe settings.

Never persist temporary tabs, PTYs, terminal contents, scrollback, history, passwords, key material, or drag state.

Normal exit and crash use the same restoration path. There is no recovery prompt. Startup restores stopped favorites and pinned geometry, selects no stopped tab automatically, and starts no process.

Closing a non-final window transfers its tabs and complete groups through the same atomic ownership command. Closing the final window stops processes and exits; there is no hidden background runtime in V1.

## Workspace creation

Creation and editing use one atomic command with icon, name, and default profile. Names are not keys and need not be unique. Validation occurs before insertion. The last workspace cannot be deleted. Workspace duplication and theme editing have no V1 command.

## SSH

V1 starts the operating system OpenSSH client in a PTY. via terminal reads but never rewrites user SSH configuration. OpenSSH owns host-key prompts, known_hosts, keys, passphrases, and agent use. via terminal never auto-accepts fingerprints or stores passwords.

Unexpected disconnects retain output and may retry after 1, 2, and 5 seconds before a manual reconnect action. Reconnect targets the same tab and never creates another row.

## Security and diagnostics

All IPC inputs are validated in Rust. Logs use structured events and redact hostnames, usernames, personal paths, commands, terminal content, and credentials. Diagnostics contain versions, capabilities, stable error codes, and redacted failures only.

Tauri capabilities remain least-privilege; the frontend receives no arbitrary shell or filesystem access.

## Testing strategy

### Domain tests

Generate and sequence mutations, asserting all invariants after every step. Cover inverse operations, stale versions, invalid targets, group limits, folder constraints, and atomic transfer failure.

### Frontend tests

Verify that one snapshot produces one row per tab; preview state never mutates source data; focus returns correctly; keyboard commands match pointer intents; and reduced motion removes transitions.

### Integration tests

Run commands through Tauri IPC with SQLite transactions and session-manager fakes. Verify no process lifecycle call occurs during organization changes.

### End-to-end tests

Exercise the scenarios in [ACCEPTANCE.md](./ACCEPTANCE.md) in the real Tauri application, including sustained terminal output, multi-window transfer, drag cancellation, restart, and crash restoration.

## Public command groups

Typed operations are grouped around workspaces, tabs, folders, sidebar moves, split groups, sessions, windows, profiles, resources, identities, settings, transfer, import/export, lock, and application lifecycle. Errors have stable machine codes and safe user messages.
