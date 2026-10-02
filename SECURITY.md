# Security policy

## Supported versions

Until the first stable release, only the latest published beta receives security fixes.

## Reporting a vulnerability

Do not open a public issue. Use GitHub's **Report a vulnerability** private advisory flow. Include reproduction steps, affected version, impact, and suggested mitigation. Never include real credentials or customer data.

Maintainers aim to acknowledge a report within 7 days, validate severity, coordinate a fix and disclosure, and credit the reporter unless anonymity is requested.

## Security boundaries

- Via verifies every SSH server key against the known hosts in its vault. New keys require confirmation; changed keys require an explicit replacement.
- Remembered passwords, passphrases and private keys are encrypted with ChaCha20-Poly1305. The key is held by the OS keychain. Without a keychain, nothing is remembered.
- Secrets never reach the interface's state, logs, exports or process arguments.
- The interface can only start shells that Via detected; it cannot launch an arbitrary executable.
- Spaces organize tabs; they are not a security boundary. All spaces share one vault.

See [docs/PRIVACY.md](docs/PRIVACY.md).
