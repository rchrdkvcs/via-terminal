# ADR 0002: Use system OpenSSH in V1

- Status: accepted
- Date: 2026-08-28

## Context

An embedded SSH implementation could provide structured credential handling and future SFTP, but substantially increases security surface and duplicates mature configuration, known-host, key, and agent behavior.

## Decision

V1 launches the operating system's OpenSSH client in a PTY. Terminarr reads existing SSH configuration but never rewrites it, never intercepts passwords, and never accepts host fingerprints automatically.

## Consequences

Existing aliases, keys, agents, and prompts work naturally. Passwords remain interactive and cannot be saved by Terminarr. Structured SFTP and advanced SSH flows remain outside V1.
