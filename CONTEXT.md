# Domain glossary

The words below are canonical. This file describes the product domain, not its implementation.

## Workspace

A named work context that owns its organization, resources, identities, favorites, and saved layout. Workspaces are isolated: ownership is never shared implicitly.

## Resource

A machine or network destination known inside exactly one workspace. Two resources may have the same address and remain fully independent.

## Identity

The non-secret authentication context used to access resources, such as a username and key reference. An identity belongs to exactly one workspace and cannot be reused by another.

## Session

A live or ended interaction with a local shell or remote resource. A session is runtime state and is not the resource or profile that created it.

## Tab

A named composition of one or more panes inside a workspace.

## Pane

One visible region of a tab that presents a session. Panes can be arranged in horizontal or vertical splits.

## Window

A native view onto workspaces and their tabs. Closing a window does not inherently close the sessions it was presenting.

## Favorite

A workspace-local shortcut to a resource.

## Temporary session

A session not represented by a saved favorite or organized sidebar entry. A temporary session may later be organized explicitly.

## Application lock

A privacy screen that blocks interaction across all windows. It does not mean that metadata stored on disk is encrypted.
