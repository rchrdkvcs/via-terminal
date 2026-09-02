# via terminal

via terminal is an open-source native terminal workspace for IT technicians. It combines fast local terminals, organized SSH resources, tabs, split panes, and Arc/Zen-style workspaces in one native application for Windows, macOS, and Linux.

> [!WARNING]
> via terminal is pre-release software. Do not rely on it as the only way to access production systems.

## V1 goals

- Local shells through a native PTY: PowerShell, CMD, WSL, and Git Bash on Windows; zsh and bash on macOS; bash, sh, and other detected shells on Linux.
- Strictly isolated workspaces with their own resources and identities.
- System OpenSSH integration, including existing SSH config, keys, and agent.
- Zen-inspired favorites, one-level folders, runtime-only temporary tabs, linked split panes, and command palette.
- A single application instance with multiple native windows.
- Local-first storage, explicit export/import, and no terminal-content persistence.

SFTP, port forwarding, bastions, cloud sync, plugins, AI, monitoring, and multi-host execution are intentionally outside V1. See [the product specification](docs/PRODUCT.md).

## Technology

- [Tauri 2](https://v2.tauri.app/) and Rust
- Vue 3 and strict TypeScript
- [xterm.js](https://xtermjs.org/)
- SQLite
- The operating system's OpenSSH client

The sidebar contract lives in [docs/SIDEBAR.md](docs/SIDEBAR.md). Architecture and security boundaries are documented in [docs/TECHNICAL.md](docs/TECHNICAL.md). Canonical product terms live in [CONTEXT.md](CONTEXT.md).

## Development

### Prerequisites (Windows)

- Node.js 22 LTS and pnpm 10
- Stable Rust toolchain with `rustfmt` and `clippy`
- Tauri's Windows prerequisites, including Microsoft C++ Build Tools and WebView2
- OpenSSH Client for remote sessions

### Prerequisites (macOS)

- Node.js 22 LTS and pnpm 10
- Stable Rust toolchain with `rustfmt` and `clippy`
- Tauri's macOS prerequisites, including Xcode Command Line Tools
- OpenSSH for remote sessions

### Prerequisites (Linux)

- Node.js 22 LTS and pnpm 10
- Stable Rust toolchain with `rustfmt` and `clippy`
- Tauri's Linux prerequisites, including WebKitGTK
- OpenSSH client for remote sessions

```bash
pnpm install --frozen-lockfile
pnpm tauri dev
```

Run the same checks as CI before opening a pull request:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm build
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo test --manifest-path src-tauri/Cargo.toml --all-features
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
```

The authoritative commands are in [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Releases

Pushing a `vX.Y.Z` tag attaches installers to a draft GitHub Release. A human publishes the draft. See [docs/RELEASING.md](docs/RELEASING.md).

## Documentation

- [Product scope](docs/PRODUCT.md)
- [Sidebar specification](docs/SIDEBAR.md)
- [Technical architecture](docs/TECHNICAL.md)
- [Acceptance scenarios](docs/ACCEPTANCE.md)
- [Privacy and local data](docs/PRIVACY.md)
- [Release checklist](docs/RELEASING.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## License

Licensed under the [Apache License 2.0](LICENSE).
