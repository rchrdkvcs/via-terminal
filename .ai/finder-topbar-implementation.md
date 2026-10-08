# Remote explorer topbar — approved prototype B

Main synchronized to 46d7f0f before completing implementation. The new keyboard
and range-selection behavior remains intact.

Approved direction: prioritize the remote path on one line, remove the folder
icon and target name at the leading edge, group creation/uploads under + and
selection/view operations under ⋯. All controls use Via's Button and DropdownMenu
primitives. No new palette, button style, dependency or SFTP operation.

Prototype primary source: local branch `prototype/finder-topbar-b-choice`.
The prototype and its runner are excluded from the implementation branch.

## Implementation

- FileNavigation composes parent, editable path and refresh with the two operation
  menus supplied by FilePanel.
- FilePath exposes the complete current path in a tooltip and an editable field.
  Enter navigates; Escape cancels and restores focus. Path spaces are preserved.
- FileToolbar keeps the existing creation/upload and view events; FileSelectionActions
  preserves the zero/single/multiple-selection guards and destructive styling.
- All topbar controls measure 28 px high, all icons 16 px with 1.5 px strokes.
  At a normal 400 px panel width, controls share the same vertical origin and
  the header measures 45 px. Below the established 16rem container threshold,
  the navigation takes a full line: at 147 px the header measures 77 px and
  adjacent controls no longer overlap.

## Verification

- T3 collaborative browser with sanitized fixture `.ai/remote-files-fixture.js`:
  docked dark 1280×800, full explorer tab light 1280×800, narrow docked panel at
  640×500 (147 px panel). Screenshots in `.ai/evidence/finder-topbar/`.
- Measured heights, icon dimensions and alignment in the rendered application.
  Checked menu contents/disabled states, selecting a file, creation menu,
  path focus and Escape, and opening the explorer in a separate tab.
- 10 new interaction tests: parent/refresh guards, path editing/cancel/focus,
  zero/single/multiple selection, disconnected operations, dock-only actions,
  all creation/upload choices and download forwarding.
- Frontend checks: format, lint, 358 tests, 4 release tests and production build pass.
  Final layout follow-up rechecked with file interaction tests and production build.
- Rust checks not run: Cargo is unavailable in this environment. No Rust changes.
- Native SSH/SFTP and platform WebViews were not exercised; browser data is fictitious.
  No added persistence, logging, IPC type, or security-sensitive logic.
