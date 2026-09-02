# Domain glossary

The words below are canonical. This file describes the product domain, not its implementation.

## Product and application

The product and repository are **via terminal**. The shipped native application is **Via**: executable, installers, Start Menu / Applications entry, window title, and install directory. Bundle identifier `dev.viaterminal.desktop` and source package names stay on via terminal so the OS identity stays unique.

## Workspace

A named and ordered work context. A workspace owns its tabs, folders, resources, identities, default terminal profile, icon, and sidebar organization. Workspaces are isolated and never share ownership implicitly. Names do not need to be unique.

## Resource

A machine or network destination known inside exactly one workspace. Two resources may have the same address and remain fully independent.

## Identity

The non-secret authentication context used to access resources, such as a username and key reference. An identity belongs to exactly one workspace and cannot be reused by another.

## Tab

A named unit of work representing exactly one session inside exactly one workspace and exactly one window at a time. A tab is the only work item represented by a sidebar row. Each tab is a unique instance in exactly one sidebar location. Pinning, unpinning, moving, splitting, or transferring a tab never creates another instance.

## Session

A live or ended interaction with a local shell or remote resource. A session belongs to exactly one tab, and a tab represents exactly one session. A session is runtime state, not the resource or profile that created it.

## Pane

The visible region that presents one tab's session.

## Split group

An ordered composition of two to four distinct tabs whose panes are linked in a horizontal or vertical split tree. The group owns only their spatial relationship: every member keeps its identity, session, and sidebar row. Members remain contiguous in the same sidebar location, folder, workspace, and window. Existing split groups cannot merge. A group with fewer than two tabs ceases to exist.

## Window

A native view onto workspaces and their tabs. A tab belongs to exactly one window at a time and may transfer between windows without restarting its session.

## Favorite

A tab pinned in its workspace. A favorite keeps its identity, name, configuration, and split relationship across application restarts, but its previous session never restarts silently. Pinning moves the same tab into the pinned area; it does not create another tab or row.

## Folder

A named, non-nestable container used only to organize favorites inside one workspace. Moving a temporary tab into a folder pins that same tab. A folder may remain empty.

## Pinned area

The ordered, hierarchical area above the sidebar divider. It contains favorites and folders. The workspace header can collapse it without affecting sessions or the temporary area.

## Temporary area

The ordered, flat area below New Terminal. It contains unpinned tabs and is never hidden by collapsing the pinned area.

## Temporary tab

An unpinned tab in the temporary area. Temporary tabs are runtime-only and are never restored after application exit or crash.

## Running tab

A tab whose session is live. Stopping a running favorite preserves the tab as stopped. A temporary tab that exits successfully is removed.

## Stopped tab

A tab with no live session. Explicitly activating a stopped favorite starts its configured terminal or connection immediately unless manual connection is enabled. Explicitly closing a stopped tab removes it.

## Focused tab

The tab whose pane currently receives keyboard input. In a visible split group, exactly one member is focused.

## New Terminal

The primary action that creates a temporary tab at the end of the current workspace's temporary area and starts the workspace's default local profile.

## Application lock

A privacy screen that blocks interaction across all windows. It does not mean that metadata stored on disk is encrypted.
