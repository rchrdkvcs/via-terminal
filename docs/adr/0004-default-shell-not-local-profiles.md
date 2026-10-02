# Default shell instead of named local profiles

- Status: deprecated (local shells are detected and chosen per tab; see CONTEXT.md)
- Date: 2026-08-29

## Context

Local profiles were a first-class, workspace-owned recipe (executable, args, working directory) shown in the sidebar next to SSH resources. Opening a terminal therefore produced two rows: the saved profile and the live tab. Users asked for « Nouveau terminal » to just open a shell, and for one settings field to pick that shell.

## Decision

Named local profiles are not a user-facing concept. A single app-wide default shell in settings launches every new local terminal. The backend still stores a workspace launch profile so `session_spawn` keeps taking a server-owned executable rather than a path from the webview.

## Consequences

The sidebar organizes SSH resources and folders only. Existing profile sidebar nodes and profile favorites are ignored by the UI. Changing the default shell rewrites each workspace's launch profile.
