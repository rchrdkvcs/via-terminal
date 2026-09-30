# V1 acceptance scenarios

These are release-level outcomes. The detailed behavior is defined in [SIDEBAR.md](./SIDEBAR.md).

## Identity and invariants

- Create, pin, unpin, reorder, folder, split, detach, and transfer tabs; after every mutation each tab identifier appears in exactly one sidebar location.
- Verify one tab maps to one session and one pane, including before and after split operations.
- Attempt invalid, cancelled, stale, fifth-member, and group-to-group drops; canonical state remains unchanged.
- Move a running tab repeatedly without recreating its renderer, duplicating output, or restarting its PTY.
- Exercise mutation failures and concurrent-window version conflicts; no partial ordering or ownership change is visible or persisted.
- Undo structural moves and deletion; the same identifiers and sessions return rather than copied entities.

## Sidebar structure

- Collapse the workspace header; favorites and folders hide while New Tab and temporary tabs remain visible and running.
- Resize, reset, hide, edge-reveal, and restore the sidebar; state is remembered per window.
- Confirm there is no compact mode or compact-density setting.
- With no displayed process, verify the main surface has no card background, border, shadow, or fake terminal frame.

## Favorites, temporary tabs, and folders

- Open New Tab by click and Ctrl+T; choose a local profile or saved SSH connection and verify a temporary tab appends at the end. Cancel the picker and verify no process or tab is created. Confirm SSH management is absent from settings.
- Exit successfully; its row disappears immediately and a stopped tab is not activated automatically.
- Cause launch failure and unexpected SSH disconnect; output and Retry, Choose another profile, and Close remain available.
- Pin a running temporary tab; the same identity moves above the divider and the process continues.
- Stop a running favorite with its minus; the favorite remains stopped. Remove it with its close action and Undo the removal.
- Create, rename, reorder, open, close, keyboard-move, and delete one-level folders.
- Attempt to nest a folder; the operation is unavailable or invalid and changes nothing.
- Delete a non-empty folder; contained favorites move to its former root position.
- Drag a temporary tab into a folder; that same tab becomes a favorite.
- Perform every organization flow using only the keyboard with visible focus.

## Split groups

- Drop an ungrouped tab on each directional target of another; create left, right, top, and bottom splits without changing either identity or session.
- Build recursive layouts up to four members and verify sidebar rows follow spatial reading order.
- Attempt a fifth member and a merge of existing groups; both are rejected without mutation.
- Pin, unpin, move, and folder one grouped row; the entire group moves and remains contiguous.
- Detach one member; its process continues and the remaining layout rebalances.
- Stop one favorite member; only that session stops and its pane can restart in place.
- Close a temporary member; only that tab disappears. A one-member group dissolves.
- Restore pinned split geometry after restart with every member stopped and no connection started.

## Drag-and-drop interaction

- Move fewer than the drag threshold and release; the row activates normally and does not move.
- Verify ghosts, before/after lines, folder fill, directional split previews, and forbidden targets are mutually unambiguous.
- Cancel with Escape, focus loss, outside release, source removal, and target invalidation; no mutation occurs and focus returns appropriately.
- Auto-scroll long tab lists and horizontally overflowing workspace strips.
- Confirm a tab drag never targets another workspace icon.
- Reorder workspaces by drag; Alt+1…9 follows the new order.

## Workspaces

- Create and edit a workspace in the temporary sidebar form with icon, non-unique name, and default profile.
- Cancel by button, Escape, and workspace selection; previous sidebar scroll, focus, and sessions remain intact.
- Submit invalid or failed creation; no partial workspace appears.
- Overflow the workspace strip; verify Zen-like horizontal scrolling, hidden scrollbar, inactive dots, hover reveal, and identifiable active workspace.
- Switch by icon, palette, Alt+number, and Ctrl+wheel; sessions continue and stopped tabs do not start.
- Use Transfer this tab to and Transfer group to; ownership validates before an atomic transfer.
- Cause an invalid dependency; nothing transfers.
- Verify cross-workspace tab drag and workspace duplication are unavailable.
- Delete an active workspace with sessions and confirm explicitly; activate its next or previous neighbor.
- Attempt to delete the last workspace; the operation is refused.

## Lifecycle and windows

- Exit normally with favorites, temporary tabs, and pinned splits. Restart: favorites and split geometry return stopped, temporary tabs do not return, and the main surface is empty.
- Simulate a crash; observe the same restoration without a recovery prompt or automatic process.
- Close a secondary window; transfer its tabs and complete groups to its creator or most recently used surviving window without changing destination focus.
- Close the final window with active sessions under both confirmation settings; processes stop gracefully and the application exits.

## Local terminal

- On Windows, start PowerShell, CMD, and WSL; enter Unicode, resize repeatedly, interrupt a process, and exit without orphaned children.
- Start Zsh through an installed WSL distribution and show a useful unavailable state otherwise.
- On macOS, start zsh and bash; enter Unicode, resize repeatedly, interrupt a process, and exit without orphaned children.
- On Linux, start bash and sh; enter Unicode, resize repeatedly, interrupt a process, and exit without orphaned children.
- Run sustained high-volume output while switching workspaces and reorganizing the sidebar; the UI remains responsive.
- Copy explicitly, paste multiline input unchanged, search output, and open detected URLs only with Ctrl+click.

## SSH, privacy, and accessibility

- Connect using SSH alias, key, and running agent while respecting user configuration.
- Verify OpenSSH handles unknown host keys and via terminal never accepts them silently.
- Disconnect unexpectedly; retain output, retry at the documented bounds, and expose manual reconnect.
- Confirm passwords, terminal content, and commands are absent from storage, logs, diagnostics, and export.
- Complete primary flows with keyboard and NVDA at 200% zoom in both themes and reduced-motion mode.

## Performance reference

Before beta, record OS, CPU, RAM, storage, WebView (WebView2, WKWebView, or WebKitGTK), and build hash. Measure usable startup under 1.5 seconds excluding first setup, keystroke responsiveness, sustained-output responsiveness, drag responsiveness, and stable memory and process counts after 100 session open/close cycles.
