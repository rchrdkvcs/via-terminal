# Product specification — V1

## Promise

Terminarr is a fast, pleasant native terminal workspace for IT technicians. It unifies local shells, SSH access, and durable organization without replacing the user's trusted shell or OpenSSH configuration.

## Audience and platform

- Primary audience: IT technicians, support engineers, and system administrators.
- Official V1 platform: Windows.
- Architecture should not deliberately prevent later macOS/Linux support.
- Distribution: open source under Apache-2.0; no account is required.

## V1 experience

- One default local shell (PowerShell, CMD, WSL, or Zsh-in-WSL), chosen in settings.
- Arc/Zen-inspired sidebar with visual favorites, nested folders, temporary sessions, and workspace icons at the bottom.
- Workspace switching by click, command palette, `Alt+1…9`, and `Ctrl+wheel` over the sidebar.
- Tabs containing horizontal or vertical split panes.
- Resources and identities isolated by workspace, even when destinations match.
- System OpenSSH integration with direct use of existing SSH config, keys, known hosts, and agent.
- One application instance with multiple windows; sessions continue across workspace and window navigation.
- Dark and light themes, normal and compact density, and configurable terminal typography.
- Keyboard-complete UI targeting WCAG 2.2 AA outside terminal-rendered content.

## Key behavior

- Clicking an open favorite focuses its existing session; a secondary action opens another.
- Changing workspace does not stop sessions.
- Closing a secondary window detaches its views rather than killing its sessions.
- An SSH disconnect keeps terminal output visible and offers bounded reconnection attempts followed by a manual action.
- Session layout is restored, but remote connections and previous commands never run silently.
- Multiline paste is transmitted immediately and unchanged; bracketed paste is honored when available.
- Only ended or disconnected temporary sessions may be cleaned automatically.

## Explicitly outside V1

SFTP, port forwarding, tunnels, ProxyJump/bastions, command snippets, multi-machine execution, cloud synchronization, team collaboration, AI, plugins, monitoring, and persistent processes after the application exits.

## Success criteria

- Input feels immediate and sustained output never freezes the surrounding UI.
- A usable window appears within 1.5 seconds on the documented reference machine, excluding first-time WebView installation.
- Workspace data never crosses isolation boundaries implicitly.
- No terminal content, command history, or SSH password is persisted.
- The core experience works fully offline except for intentional remote connections and update checks.
