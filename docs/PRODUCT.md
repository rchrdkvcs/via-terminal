# Product specification — V1

## Promise

via terminal is a fast, pleasant native terminal workspace for IT technicians: a Zen Browser-like navigator for local shells and SSH sessions, with durable organization and reliable spatial behavior.

The product name is **via terminal**. The native application is **Via**: that is the executable, installer, install directory, and OS application list name.

## Audience and platform

- Primary audience: IT technicians, support engineers, and system administrators.
- Official V1 platforms: Windows, macOS, and Linux.
- Architectures: Windows x64, macOS Apple Silicon (arm64), Linux x64.
- Installers are published on GitHub Releases for each version tag.
- Distribution is open source under Apache-2.0; no account is required.

## Core experience

- A resizable, hideable Zen-inspired sidebar is the primary product surface.
- One tab represents one session and one sidebar row; identity is never duplicated.
- Workspaces isolate organization, resources, identities, default profiles, and tabs.
- Favorites and one-level folders live above the divider.
- New Terminal and runtime-only temporary tabs live below it.
- Tabs can link into groups of two to four split panes.
- A bottom workspace strip follows Zen's horizontal overflow behavior.
- Workspace switching works by click, palette, Alt+1…9, and Ctrl+wheel over the sidebar.
- Tabs transfer between workspaces only through an explicit context menu.
- One application instance supports multiple native windows.
- The UI is keyboard-complete and targets WCAG 2.2 AA outside terminal-rendered content.

The exhaustive sidebar contract is in [SIDEBAR.md](./SIDEBAR.md).

## Terminal and connection behavior

- Each workspace has a default local profile: PowerShell, CMD, WSL, or Git Bash on Windows; zsh or bash on macOS; bash, sh, or another detected shell on Linux.
- New Terminal appends and starts a temporary tab with that profile.
- Alternative profiles and SSH resources are available from a secondary selector.
- Activating a stopped favorite starts it immediately unless manual connection is enabled.
- A successful temporary-session exit removes its tab; failures remain inspectable.
- Running sessions continue across workspace navigation and sidebar organization.
- SSH uses the operating system OpenSSH configuration, keys, known hosts, and agent.
- Unknown host keys remain OpenSSH prompts.
- Unexpected SSH disconnects retain output and offer bounded reconnection attempts.

## Durable and temporary state

Persist workspaces, favorites, folders, pinned split layout, names, ordering, sidebar state, and window state. Never persist temporary tabs, live processes, terminal contents, scrollback, command history, passwords, or secrets.

Normal exit and crash have the same restoration contract: durable organization returns stopped, no temporary tab returns, no recovery prompt appears, and no process starts automatically.

## Visual behavior

- Selected sidebar rows use restrained hierarchy rather than card borders.
- Folder icons themselves communicate open and closed state.
- Stop and remove actions appear on hover and keyboard focus.
- The main surface has no card background or border when no process is displayed.
- Motion explains spatial changes, remains interruptible, and respects reduced motion.
- Compact sidebar mode and compact-density settings are outside V1.

## Explicitly outside V1

SFTP, port forwarding, tunnels, ProxyJump/bastions, command snippets, multi-machine execution, cloud synchronization, team collaboration, AI, plugins, monitoring, persistent processes after application exit, nested folders, workspace duplication, workspace theme editing, cross-workspace drag-and-drop, split-group merging, and temporary-tab restoration.

## Success criteria

- A drag or keyboard move cannot duplicate, lose, or restart a tab.
- Invalid targets leave canonical state unchanged.
- Input feels immediate and sustained output never freezes the surrounding UI.
- A usable window appears within 1.5 seconds on the documented reference machine, excluding first-time WebView installation.
- Workspace data never crosses isolation boundaries implicitly.
- No terminal content, command history, or SSH password is persisted.
- The core experience works offline except for intentional remote SSH connections and user-initiated browser downloads of a new GitHub Release. The running app does not check for updates.
