# The frontend owns tab organization, Rust validates what persists

- Status: accepted
- Date: 2026-10-02

Sidebar organization (spaces, rows, folders, splits, pinning) is a pure TypeScript module applying a closed set of intents to an in-memory space; the store saves the pinned part as one layout document that Rust validates structurally before writing. The previous design routed every drag through a Rust transaction plus a frontend mirror of the same rules, which doubled the logic and produced most of the bugs. Rust stays authoritative for the vault, secrets and sessions, where the stakes are security and processes rather than ordering.

## Consequences

- Temporary tabs and live session state never cross IPC as organization data.
- A malformed layout is rejected by Rust and the previous one kept; the UI never repairs state while rendering.
