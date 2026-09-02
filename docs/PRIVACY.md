# Privacy and local data

via terminal is local-first and requires no account.

## Stored locally

- Workspace names and organization
- Resource addresses and non-secret identity metadata
- Default shell setting and non-secret environment values
- Favorites, tab/pane layouts, window state, and preferences
- Redacted rotating diagnostics

This metadata is not encrypted in V1. Anyone with access to the user's OS account and the application data directory on that platform may be able to read it.

## Never stored by via terminal

- SSH passwords or passphrases
- Private key contents
- Terminal scrollback or command output
- Shell command history
- Clipboard contents

Private keys and agents remain managed by OpenSSH and the operating system. The optional app lock only hides the interface; it does not encrypt data at rest.

## Network activity

via terminal makes network connections when the user starts SSH or explicitly opens a terminal link. The app does not check for updates by itself in this release; users download new versions from GitHub Releases. V1 has no product analytics. Crash or diagnostics submission is voluntary and never automatic.

## Export and deletion

Versioned export contains workspace organization and settings but excludes secrets and terminal contents. Users should inspect it before sharing because resource names and addresses may still be sensitive. Uninstall behavior and the application-data location must be shown in the release documentation so users can remove local metadata deliberately.
