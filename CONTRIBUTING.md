# Contributing

Thanks for helping build Terminarr. The project is focused on the Windows V1 described in [docs/PRODUCT.md](docs/PRODUCT.md).

## Before starting

1. Search existing issues.
2. Describe the user scenario and acceptance criteria for behavior changes.
3. Keep changes small and vertical; avoid speculative abstractions or features outside V1.
4. Use the terms in [CONTEXT.md](CONTEXT.md).

## Development rules

- Keep native process, database, and session authority in Rust.
- Never log terminal contents, commands, usernames, hosts, personal paths, credentials, or key material.
- Never persist terminal scrollback or command history.
- Enforce workspace ownership at the backend boundary, not only in the UI.
- Test behavior at public seams: Tauri commands/domain services, Vue interactions, and end-to-end workflows.
- Keep keyboard access and visible focus working with every UI change.

Pull requests must include tests, sanitized visual evidence for UI changes, security/privacy impact, and documentation updates when a durable decision changes. Run the checks listed in the README before requesting review.

ADRs are reserved for decisions that are expensive to reverse, surprising without context, and based on a real trade-off.
