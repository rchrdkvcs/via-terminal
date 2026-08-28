# ADR 0001: Strict workspace ownership

- Status: accepted
- Date: 2026-08-28

## Context

Technicians may access the same destination from two client or responsibility contexts using different identities. Globally shared resources or identities would make changes and credential selection leak unexpectedly between contexts.

## Decision

Resources, identities, profiles, favorites, and saved layouts belong to exactly one workspace. Equal host addresses do not imply identity or sharing. Workspace duplication creates independent records and copies no secret.

## Consequences

The backend and database must validate ownership on every relationship. Users may duplicate some metadata, but receive predictable isolation and can intentionally model the same destination differently.
