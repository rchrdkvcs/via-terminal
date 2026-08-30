# ADR 0003: One instance with multiple windows

- Status: accepted
- Date: 2026-08-28

## Context

Users need multiple native windows without duplicate PTYs, competing SQLite writers, or sessions tied to a window's lifetime.

## Decision

Terminarr runs one application instance with shared Rust-owned persistence and session management. Multiple native windows display that shared state. Each tab and session belongs to exactly one window at a time. A session has at most one active renderer and can be transferred without restarting its process.

## Consequences

Launching Terminarr again creates a window in the running instance. Closing a secondary window transfers its tabs and complete split groups to a surviving window without terminating their sessions. Window coordination and global locking must be explicit, while database writes remain serialized in one process.
