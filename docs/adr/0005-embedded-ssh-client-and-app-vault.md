# Embedded SSH client, vault owned by the app

- Status: accepted
- Date: 2026-10-02

Via connects with an embedded SSH client (`russh`) instead of launching the system OpenSSH in a PTY, and never reads `~/.ssh/config`, the system `known_hosts` or `~/.ssh/id_*`. OpenSSH in a PTY made host-key confirmation, remembered passwords, progress feedback and clean reconnection impossible to present in the interface, which is what users expect from a client that manages their servers. Everything a connection needs lives in the vault, so a host behaves the same on every machine and no system file is ever touched.

## Consequences

- Via owns host-key verification: unknown and changed keys are confirmed in the pane, accepted keys are stored as known hosts in the vault.
- Users with an existing key import it once (paste or file); the copy lives in the vault.
- ProxyCommand, ProxyJump, agent forwarding and `Match` blocks are unavailable until Via implements them itself.
