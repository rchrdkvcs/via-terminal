# Privacy and local data

Via is local-first: no account, no telemetry, no cloud. The application only opens network connections to the SSH servers the user connects to, and to links the user opens with Ctrl+click.

## Stored locally

In `via.sqlite`, in the application data directory:

- Spaces, pinned tabs, folders and split layouts.
- Settings.
- The vault: host labels, addresses, ports, usernames, tags, notes, groups, identities, public keys and accepted server fingerprints.
- Secrets (passwords, passphrases, private keys), **encrypted** with ChaCha20-Poly1305. The 256-bit key lives in the operating system keychain (Windows Credential Manager, macOS Keychain, Secret Service), under the service `dev.viaterminal.desktop`.

Everything except secrets is stored unencrypted. Anyone with access to the user's OS account can read hosts and addresses.

If no keychain is available, Via does not remember any secret. It asks for each password every time.

## Never stored

- Terminal contents, scrollback and command history.
- Temporary tabs.
- Answers to keyboard-interactive challenges (one-time codes).
- Secrets in clear, in logs or in process arguments.

Via never reads or writes `~/.ssh/config`, the system `known_hosts` or the user's key files. A key file chosen for import is read once and copied, encrypted, into the vault.

## Data location

Durable data lives under the bundle identifier `dev.viaterminal.desktop`:

- Windows: `%APPDATA%\dev.viaterminal.desktop\via.sqlite`
- macOS: `~/Library/Application Support/dev.viaterminal.desktop/via.sqlite`
- Linux: `$XDG_DATA_HOME/dev.viaterminal.desktop/via.sqlite`

Uninstalling does not always remove it. To start from a clean slate, delete that directory and the `vault-master-key` keychain entry.
