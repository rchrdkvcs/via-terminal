# V1 acceptance scenarios

These scenarios are the release-level public seams. Unit and integration tests may cover smaller behavior, but V1 is accepted through these outcomes.

## Local terminal

- Start PowerShell, CMD, and WSL; enter Unicode, resize repeatedly, interrupt a process, and exit without orphaned children.
- Run sustained high-volume output while switching workspaces and using the sidebar; UI remains responsive.
- Start Zsh through a WSL distribution when installed; show a useful unavailable state otherwise.
- Copy explicitly, paste multiline input unchanged, search output, and open a detected URL only with `Ctrl+click`.

## Isolation and organization

- Create two workspaces targeting the same host as different users; edits and identity choices do not propagate.
- Duplicate a workspace; structure is copied with fresh identifiers and no secret.
- Create, nest, rename, keyboard-move, drag, and delete folders/resources/profiles.
- Collapse folders and the active workspace section, restart, and verify that each workspace restores its own expansion state.
- Rename a workspace or open tab inline with Enter, Escape, blur, and keyboard-only focus restoration.
- Drag a sidebar entry before, after, or into a folder; invalid descendant drops must leave the tree unchanged.
- Switch by icon, palette, `Alt+number`, and sidebar `Ctrl+wheel`; active sessions continue.
- Switch rapidly between workspaces and verify the directional transition never recreates or closes a terminal; reduced-motion removes the movement.
- Hide the sidebar and recover it through the delayed edge reveal and keyboard command.

## Tabs, recovery, and windows

- Mix a local and SSH session in split panes, resize them, restart cleanly, and recover their layout without automatic SSH reconnection.
- Simulate a crash; choose recovery or clean start, with no previous command replay.
- Open a second window, move an active tab, and verify no output duplication or PTY restart.
- Close a secondary window; reopen its detached session elsewhere. Locking one window locks all.

## SSH

- Connect using an SSH alias, key, and running agent while respecting user SSH configuration.
- Encounter an unknown host key and verify OpenSSH prompts rather than Terminarr accepting it.
- Disconnect unexpectedly; observe retries after 1, 2, and 5 seconds, then a manual reconnect action.
- Confirm SSH password input works interactively and is absent from storage, logs, and export.

## Portability, accessibility, and privacy

- Export, inspect, and import into a clean profile; organization returns with new identifiers and no terminal content or secrets.
- Complete primary flows using only the keyboard with visible focus; verify UI controls with NVDA, 200% zoom, both themes, and reduced motion.
- Exercise multiple monitors/DPI, suspend/resume, install/update/uninstall, and Windows shutdown with active sessions.
- Inspect diagnostics and rotating logs using synthetic sensitive values; none survive redaction.

## Performance reference

Before beta, record Windows version, CPU, RAM, storage, WebView2, and build hash. Measure usable startup (target under 1.5 s excluding first setup), keystroke responsiveness, sustained-output responsiveness, and stable memory/process counts after 100 session open/close cycles.
