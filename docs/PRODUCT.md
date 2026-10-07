# Product specification

## Promise

Via is a terminal you enjoy living in: a sidebar of spaces and tabs for your sessions, a vault for your servers, and nothing in between. Opening a shell or a server is one shortcut and a few letters away.

## Audience and platforms

- IT technicians, support engineers, system administrators and developers.
- Windows x64, macOS arm64 and Linux x64. Installers are published on GitHub Releases.
- Open source under Apache-2.0. No account, no cloud, works offline.

## The window

```
┌───────────────┬──────────────────────────────────────────┐
│ ▯             │        [ prod-web         ]   ⚿ ⚙  – ▢ ✕ │
│ Space name    │ ┌──────────────────────────────────────┐ │
│ ▸ Clients     │ │                                      │ │
│   pinned …    │ │                                      │ │
│ ───────────── │ │          active tab or split         │ │
│ + New tab     │ │                                      │ │
│   temporary … │ │                                      │ │
│               │ │                                      │ │
│    ◉ ◯ ◯    + │ └──────────────────────────────────────┘ │
└───────────────┴──────────────────────────────────────────┘
```

- **Sidebar**, from top to bottom: the sidebar toggle, the space name and its pinned area (pinned tabs, split views and folders), a divider, New tab, the temporary tabs, and the space switcher: spaces centered, New space on the right.
- **Content**: the active row, shown as a single terminal or a split view, on a rounded surface. No tab strip.
- The sidebar can be hidden and shown again with Ctrl+Shift+B or its button. A thin title bar above the content holds the address pill of the current tab in the middle, and the vault, settings and window controls top right. It stays when the sidebar is hidden.

## Opening things

- Shortcuts use Ctrl+Shift on Windows and Linux, so the shell keeps Ctrl+W, Ctrl+D, Ctrl+L and the other line-editing keys, and ⌘ on macOS.
- **Ctrl+Shift+T** opens the command bar. It lists local shells, recent hosts, then every host matching what you type (label, address, user, tags, group). Enter opens the selection as a new temporary tab.
- Typing `user@host`, `host:2222` or `ssh user@host -p 2222` offers **Connect to …**. When authentication succeeds, the host is saved in the vault automatically.
- **Ctrl+Shift+L** (or clicking the address pill) opens the command bar for the current tab: Enter replaces what the tab connects to.
- **Ctrl+Shift+P** opens the same bar with actions first: new space, open vault, settings, split, pin, rename, close.
- From the vault, double-click or **Connect** opens a host in a new tab of the current space.

## Tabs

- New tabs appear at the top of the temporary area.
- **Pin** (Ctrl+Shift+D, menu, or drag above the divider) keeps a tab across restarts. Unpinning drops it back to the temporary area.
- At launch, pinned tabs are **asleep**: dimmed, no process running. Clicking one starts it. Nothing connects by itself.
- A pinned tab remembers its target and its name. A local tab also remembers the folder its shell was last in, and reopens there (Git Bash, bash, zsh, PowerShell and cmd report it; other shells reopen in the home folder).
- A host saved by quick connect is named after its address until named: naming its tab names the host, so the sidebar, the command bar and the vault show one name.
- A temporary local shell that exits normally closes its tab. A failed launch or a dropped SSH connection keeps the tab with its output and offers Reconnect.
- Ctrl+Shift+W closes the current tab; closing a pinned tab puts it to sleep, closing again removes it. Removing offers Undo.
- Renaming: double-click a row or F2. A manual name stops following the terminal title until reset.
- Ctrl+Tab / Ctrl+Shift+Tab cycle tabs in sidebar order; Ctrl+1…9 switch spaces.

## Split view

- Drag a row onto the left, right, top or bottom of the content area, or onto another row's edge, or use **Split with…** from a row menu or Alt+Shift+D (opens the command bar for the second tab).
- A split view holds two to four tabs, horizontally or vertically, with resizable panes. It is one row in the sidebar showing each member.
- Clicking a member in the row focuses that pane. **Detach** turns a member back into its own row. Closing a member only closes that tab.

## Folders and spaces

- Folders exist only in the pinned area, one level deep. Dragging a temporary tab into a folder pins it. Deleting a folder keeps its tabs.
- Spaces are listed at the bottom of the sidebar. Click, Ctrl+1…9, or a horizontal swipe / Ctrl+wheel switches space; sessions keep running in the background.
- Creating or editing a space asks for a name, an icon and an optional default shell. The last space cannot be deleted. Deleting a space with running tabs asks for confirmation.
- A tab moves to another space from its menu (**Move to space**).

## Connecting over SSH

- Via has its own SSH client. It never reads `~/.ssh/config`, the system `known_hosts` or `~/.ssh/id_*`.
- While connecting, the pane shows the steps (resolving, connecting, verifying the server, authenticating) instead of a blank terminal.
- **New server key**: the pane shows the fingerprint and asks Trust and connect / Cancel. **Changed key**: the pane warns clearly, shows both fingerprints and requires an explicit Replace and connect.
- **Credentials** are tried in this order: the key, then the stored password, from the host first, then its identity, then its groups. Missing credentials are asked for in the pane, with a Remember option that stores them in the vault.
- Keyboard-interactive challenges (2FA codes) are asked in the pane and never stored.
- An unexpected disconnect keeps the output and shows Reconnect. Typing Enter in a disconnected pane also reconnects.

## Remote files

SSH tabs offer an independent remote explorer through the top-right file-tree icon or the command bar. Resize it beside the terminal or detach it into its own explorer tab; each document opens in its own tab. Explorer and document tabs open their own connection. Create, move, delete and change permissions; transfer files and folders; view and explicitly save UTF-8 documents. Drafts remain in memory and closing asks before discarding them. Transfers report progress and support cancellation, retry and collision choices. Safe document replacement requires server support. See [REMOTE-FILES.md](REMOTE-FILES.md) for limits and acceptance scenarios.

## Vault

A full page (sidebar stays) with:

- **Hosts**: groups as a tree on the left, hosts of the selected group in the middle (including sub-groups), and an editor on the right. Creating a host only needs an address; everything else is optional. Search filters by label, address, user and tags.
- **Identities**: username plus a password or key, referenced by hosts and groups.
- **Keys**: generate Ed25519, import by pasting or choosing a file (the file is copied into the vault), copy the public key, delete.
- **Known hosts**: accepted fingerprints, removable.
- Every change is saved immediately; there is no Save button except when creating.
- Inherited values appear as placeholders showing where they come from.
- Deleting a host used by pinned tabs asks for confirmation; those tabs stay and show that their host is gone.

## Settings

A full page with General (default shell, behavior on close, quick-connect auto-save), Appearance (theme, font, size, cursor), Terminal (scrollback, line height, copy on select) and Shortcuts (read-only reference). SSH data never appears in settings.

## Persistence

- Persisted: spaces, pinned rows, folders, split layouts of pinned rows, sidebar width and visibility, settings, the vault.
- Never persisted: temporary tabs, processes, terminal contents, scrollback, command history.
- Secrets are encrypted with a key held in the OS keychain (Credential Manager, Keychain, Secret Service). If no keychain is available, Via does not remember secrets and asks for them each time.

## Visual principles

- One neutral palette, black and white, in a dark and a light theme. Spaces have no color.
- Depth comes from materials, not color: the sidebar sits on the window chrome; content is a raised surface; menus, dialogs and inspectors float above it with a lit top edge; controls are lit keys with a hairline and a soft drop; fields are pressed into the surface.
- Full pages (vault, settings) share one frame: a wide rail of sections on a half-step tint, the page beside it, no borders between them. Inspectors float on the right and can be resized.
- Selected rows are lit; asleep rows are dimmed; connection progress is the only animated indicator.
- Things used many times a day (command bar, space switch, shortcuts) appear at once. Motion is reserved for spatial changes, stays under 250 ms, and disappears with reduced motion.
- A drop target is always one line in one gap; a drop that would change nothing shows nothing.
- The window chrome quiets down while the window is in the background.
- Every pointer action has a keyboard or menu equivalent.

## Outside this release

Port forwarding, jump hosts and proxies, snippets, broadcast input, multiple windows, cloud sync, teams, AI, plugins, SSH agent forwarding, and importing system SSH configuration.

## Success criteria

- From launch, opening a saved server takes Ctrl+Shift+T, a few letters and Enter.
- Adding a new server takes typing `user@host` and authenticating once.
- Moving, pinning or splitting a running tab never restarts it or loses its scrollback.
- No secret is readable in the database, exports, logs or process list.
- A usable window appears within 1.5 s on the reference machine.
