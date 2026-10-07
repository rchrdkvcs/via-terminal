# via terminal

Via is an open-source terminal for Windows, macOS and Linux. Its sidebar organizes your work into spaces, with pinned and temporary tabs, folders and split views. Its vault keeps your servers: hosts, groups with inherited settings, identities, keys and known fingerprints. It runs entirely locally, with no account or cloud. The shipped app is named **Via**.

> [!WARNING]
> Via is pre-release software. Do not rely on it as your only way to reach production systems.

## What it does

- Local shells in a native PTY: PowerShell, CMD, WSL and Git Bash on Windows, and the installed shells on macOS and Linux.
- An embedded SSH client. Via verifies server keys in the interface, can remember passwords and passphrases (encrypted, with the key held by the OS keychain), asks for 2FA codes, and reconnects in place.
- A command bar (Ctrl+Shift+T, or ⌘T on macOS) to open a shell or a saved host, or to connect straight to `user@host:port`. Hosts you connect to this way join the vault.
- Spaces tinted by their color, pinned tabs that come back asleep after a restart, split views of up to four tabs, and drag and drop.
- Signed in-app updates: a title-bar indicator announces new stable versions; download and restart when ready. Automatic startup checks can be disabled in Settings.

The full behavior is in [docs/PRODUCT.md](docs/PRODUCT.md), the vocabulary in [CONTEXT.md](CONTEXT.md), the structure in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the decisions in [docs/adr](docs/adr). Via never reads your `~/.ssh` directory; see [docs/PRIVACY.md](docs/PRIVACY.md).

## Development

Prerequisites: Node.js 22, pnpm 10, stable Rust with `rustfmt` and `clippy`, and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (WebView2 on Windows, Xcode Command Line Tools on macOS, WebKitGTK on Linux).

```bash
pnpm install --frozen-lockfile
pnpm tauri dev
```

Run the same checks as CI before opening a pull request:

```bash
pnpm format:check && pnpm lint && pnpm test && pnpm test:release && pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml --all-features
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```
