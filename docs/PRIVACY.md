# Privacy and local data

Via is local-first: no account, no telemetry, no cloud. The application opens network connections to the SSH servers the user connects to, links the user opens with Ctrl+click, and the public GitHub release endpoint for updates. Installed release builds check once after startup by default; disable this in Settings → General → Updates. Development and browser previews do not check automatically. Manual checks remain available. Downloads follow GitHub redirects to its asset hosting infrastructure.

Update requests disclose the client IP address and standard HTTP metadata to GitHub and its download infrastructure. The application does not send vault records, credentials, terminal contents, commands, or telemetry. Update packages are verified with an embedded public signing key before installation.

## Stored locally

In `via.sqlite`, in the application data directory:

- Spaces, pinned tabs, their last remote explorer directory, folders and split layouts.
- Settings.
- The vault: host labels, addresses, ports, usernames, tags, notes, groups, identities, public keys and accepted server fingerprints.
- Secrets (passwords, passphrases, private keys), **encrypted** with ChaCha20-Poly1305. The 256-bit key lives in the operating system keychain (Windows Credential Manager, macOS Keychain, Secret Service), under the service `dev.viaterminal.desktop`.

Everything except secrets is stored unencrypted. Anyone with access to the user's OS account can read hosts and addresses.

If no keychain is available, Via does not remember any secret. It asks for each password every time.

## Never stored

- Terminal contents, scrollback and command history.
- Temporary tabs and remote document contents or drafts.
- Answers to keyboard-interactive challenges (one-time codes).
- Secrets in clear, in logs or in process arguments.

Via never reads or writes `~/.ssh/config`, the system `known_hosts` or the user's key files. A key file chosen for import is read once and copied, encrypted, into the vault.

## Data location

Durable data lives under the bundle identifier `dev.viaterminal.desktop`:

- Windows: `%APPDATA%\dev.viaterminal.desktop\via.sqlite`
- macOS: `~/Library/Application Support/dev.viaterminal.desktop/via.sqlite`
- Linux: `$XDG_DATA_HOME/dev.viaterminal.desktop/via.sqlite`

Uninstalling does not always remove it. To start from a clean slate, delete that directory and the `vault-master-key` keychain entry.

## File transfers

SFTP reuses the SSH connection and its verified server key. No file paths or contents are logged. Browser-originated drops are staged temporarily under the application cache (`file-drops`), with private directory permissions on Unix, then removed after completion or cancellation. Failed transfers retain staging for explicit retry; staging is removed on normal exit and stale staging is cleared at the next launch. Uploads and downloads use temporary files beside the destination; interrupted cleanup can leave temporary files and is reported when detectable.

Document saves preserve Unix mode, owner and group. ACLs, extended attributes and hard-link relationships are not guaranteed; files depending on those properties are outside the editor’s supported scope.
