# Sidebar specification

This is the functional source of truth for Terminarr's sidebar. Its behavior is inspired by [Zen Browser](https://github.com/zen-browser/desktop), adapted to terminals; Zen's implementation is not copied.

## Principle and layout

A sidebar row always represents one tab, and one tab always represents one session. Moving a row relocates that same tab; it never creates another tab, session, or row.

The expanded sidebar contains, from top to bottom:

1. current workspace header;
2. pinned area;
3. divider;
4. New Terminal;
5. temporary area;
6. flexible space;
7. workspace strip and global add action.

The workspace header collapses only the pinned area. New Terminal, temporary tabs, and the workspace strip remain visible. Collapsing never stops a session.

The sidebar width is adjustable between a usable minimum and about 40% of the window. Double-clicking the resize edge restores the default. Width is remembered per window. The only visibility states are expanded and hidden: there is no compact mode or compact-density setting. A shortcut toggles visibility, and delayed edge reveal may expose it temporarily.

## Tab lifecycle

### Invariants

- A tab has one stable identifier.
- It belongs to exactly one workspace and one window.
- It occupies exactly one sidebar location.
- It represents exactly one session and pane.
- It belongs to at most one split group.
- Pinning, moving, splitting, and transferring preserve its identity.

### Favorites

A running favorite shows a minus on hover or keyboard focus. The minus stops its session but preserves the stopped favorite. A stopped favorite shows a close action. Closing removes it and offers Undo, which restores the same identity, configuration, name, and position.

Activating a stopped favorite immediately starts its configured shell or connection. A global manual-connection setting may require an explicit Start or Reconnect action; a sensitive favorite can always require confirmation.

### Temporary tabs

New Terminal appends a temporary tab and starts the workspace's default local profile. A successful or intentional process exit removes the tab immediately. A launch failure or unexpected SSH disconnection preserves it so the user can inspect output and Retry, Choose another profile, or Close.

Temporary tabs are never persisted or restored after exit or crash.

### Focus after removal

Only a running tab may become the automatic replacement:

1. a running neighbor in the same split group;
2. the next running temporary tab;
3. the previous running temporary tab;
4. the most recently focused running favorite;
5. otherwise the empty state.

A stopped tab never starts because another tab closed or a workspace was activated.

## Folders and pinned organization

Favorites and folders share an ordered root. Folders exist only in the pinned area, cannot nest, and may remain empty. Their open or closed icon is the only disclosure indicator; there is no chevron. Activating the row opens or closes it. Hidden sessions continue running, and expansion is remembered per workspace.

Moving a temporary tab into a folder pins that same tab. Unpinning moves it to the temporary area. Deleting a non-empty folder moves its contents to the folder's former root position and never deletes the tabs.

The folder menu contains Rename, New folder after, and Delete folder. It does not create or start terminals.

## New Terminal

A primary click appends and focuses a temporary tab using the workspace default. A chevron, secondary click, or keyboard command opens the profile and resource selector. An alternative choice never changes the default silently. New tabs always go to the end of the temporary area.

## Split groups

Dropping an ungrouped tab on an explicit left, right, top, or bottom target of another ungrouped tab creates a split. Before and after targets reorder instead.

A split group:

- contains two to four tabs in a horizontal or vertical split tree;
- preserves one row, identity, and session per member;
- keeps members contiguous in spatial reading order;
- displays the full group when any member is activated;
- gives terminal focus to exactly one member;
- keeps every member in the same workspace, window, pinned state, and root or folder location;
- cannot merge with another existing group.

Dropping a temporary tab onto a favorite pins it. Dropping onto a favorite in a folder also moves it into that folder. Pinning, unpinning, foldering, or moving a grouped row applies to the complete group. To operate on one member, first use Detach from split.

Dragging a grouped row moves the whole group. Detaching preserves the tab and session. A group disappears below two members. A fifth member and group-to-group drops are invalid.

Stopping or removing one member affects only that tab. A stopped favorite can retain its pane and restart in place; removing a temporary member rebalances the layout. Pinned geometry persists, but no session restarts automatically. Activating a stopped member starts only that member.

## Drag-and-drop

The only valid mutations are:

1. reorder favorites, folders, or pinned groups at the root;
2. move a favorite or pinned group into a folder;
3. move one out to the pinned root;
4. reorder temporary tabs or groups;
5. pin a temporary tab or group by dropping in the pinned area or a folder;
6. unpin a favorite or group by dropping in the temporary area;
7. create a split between ungrouped tabs;
8. reorder workspaces in their strip.

There is no cross-workspace tab drag. Context menus provide Transfer this tab to and, when grouped, Transfer group to.

### Feedback and cancellation

- Drag starts after about 6 px of movement.
- A ghost represents the source.
- A line means before or after.
- A filled folder target means move into folder.
- A directional pane target means split.
- Invalid targets show a forbidden state.
- One target represents exactly one operation.
- Escape, focus loss, release outside a target, stale state, a fifth member, or group-to-group targeting cancels without mutation.
- List edge auto-scroll is progressive; workspace reorder uses horizontal auto-scroll.
- Tab dragging never targets or auto-scrolls the workspace strip.
- Pointer drag restores terminal focus to the moved tab; keyboard movement preserves sidebar focus.

Canonical state does not move until a valid drop commits. Invalid or cancelled drops leave the domain state unchanged.

Undo is offered for pinning, unpinning, folder moves, split creation or detachment, transfer, and stopped-tab deletion. Simple reorder has no notification. Undo applies an inverse mutation to the same identifiers; it never copies objects.

## Workspaces

### Strip

Overflow follows Zen Browser: one horizontal row, hidden scrollbar, horizontal scrolling, inactive overflow icons compacting to dots and revealing on hover, and an identifiable active workspace. Clicking an icon only switches workspace. Dragging icons reorders workspaces and therefore Alt+1 through Alt+9. Clicking the active icon does not collapse the pinned area.

Each window remembers its active workspace. A new window inherits the source window's active workspace when applicable.

### Creation and editing

New workspace temporarily replaces the sidebar's main content with an inline Zen-like form while sessions and the workspace strip remain available. It contains an icon cell to the left of a required name, a default terminal profile, and bottom-anchored Create workspace and Cancel actions. There is no theme editor, and names need not be unique.

Cancel, Escape, or selecting another workspace abandons the form without confirmation. Creation and editing are atomic; errors remain inline. Successful creation activates the workspace.

Workspace menus contain Edit workspace, New terminal, New folder, and Delete workspace. Duplication is unsupported. The final workspace cannot be deleted. Deleting an active workspace with sessions requires explicit confirmation, then activates the next neighbor or the previous one.

### Transfer

Transfer is context-menu only. Transfer this tab detaches one grouped member if needed; Transfer group moves all members atomically. The target list excludes the source. Ownership and resource dependencies are validated before mutation. Failure transfers nothing, and folders never transfer implicitly.

## Names, empty states, and errors

A tab follows a safe terminal title until renamed. A manual name ignores later terminal title changes; Use automatic title restores dynamic naming. Workspace and folder renaming is inline: Enter commits, Escape cancels, and focus returns to the initiating row.

With no displayed process, the main surface has no card background, border, shadow, or fake terminal frame. It uses the continuous application background with restrained copy and New Terminal. Explicitly selecting a stopped favorite may show Start or Reconnect on the same unframed surface.

Launch and connection errors remain visible and actionable. A temporary error tab is not removed before it can be inspected or closed.

## Visual and accessible behavior

- Selected rows use a subtle background and stronger text, not card borders.
- Visible split members share a restrained grouping cue; only one has terminal focus.
- Running, connecting, disconnected, error, and stopped states have accessible labels.
- Running indicators are static; only connection progress may animate briefly.
- Folder icons communicate disclosure state.
- Stop and remove actions appear on hover and keyboard focus with at least a 28 by 28 px target.
- Motion explains spatial change, is short and interruptible, and is removed by reduced-motion preferences.

Every pointer operation has a keyboard or menu equivalent: row navigation, folder disclosure, activation, rename, move, pin, unpin, split, detach, stop, delete, workspace navigation, sidebar visibility, and context menus. Exact bindings remain configurable and follow Windows conventions.

## Persistence and windows

Persist workspaces, icons, order, profiles, favorites, folders, pinned split geometry, disclosure states, window geometry, sidebar width and visibility, and active workspace.

Never persist temporary tabs, processes, terminal content, scrollback, command history, secrets, or an in-progress drag.

Normal exit and crash restore the same durable organization. There is no recovery prompt. Startup shows an empty main surface, stopped favorites, and no automatic process.

Closing a window transfers its tabs and groups atomically to its creator window when available, otherwise the most recently used surviving window. Existing destination focus remains unchanged. Closing the final window exits and stops sessions gracefully, with optional confirmation for active terminals.

## Acceptance bar

The sidebar is incomplete until:

- every tab identifier occurs exactly once in its window projection;
- no tab exists in both pinned and temporary areas;
- no tab belongs to two folders or two groups;
- group members are contiguous and share workspace, window, status, and location;
- invalid drops produce no mutation;
- moving a running tab never restarts its process or renderer;
- pointer and keyboard flows have parity;
- behavior is exercised in the real Tauri application;
- documentation, frontend projection, backend invariants, and tests agree.
