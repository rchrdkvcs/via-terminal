# Security policy

## Supported versions

Until the first stable release, only the latest published beta receives security fixes.

## Reporting a vulnerability

Do not open a public issue. Use GitHub's **Report a vulnerability** private advisory flow. Include reproduction steps, affected version, impact, and suggested mitigation. Never include real credentials or customer data.

Maintainers aim to acknowledge a report within 7 days, validate severity, coordinate a fix and disclosure, and credit the reporter unless anonymity is requested.

## Security boundaries

- via terminal uses the operating system's OpenSSH client and does not silently accept host fingerprints.
- SSH passwords are entered interactively and are not saved.
- Workspace isolation prevents implicit sharing but is not an operating-system security boundary.
- The application lock is a privacy screen; it does not encrypt SQLite metadata.
- Export excludes secrets and terminal contents, but users must inspect exports before sharing.

See [docs/PRIVACY.md](docs/PRIVACY.md).
