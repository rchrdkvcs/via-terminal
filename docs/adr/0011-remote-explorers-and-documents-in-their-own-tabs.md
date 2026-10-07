# Remote explorers and documents live in their own tabs

- Status: accepted and implemented; supersedes ADR-0009
- Date: 2026-10-07

A remote explorer can sit docked beside an SSH terminal or fill its own tab, and every remote document fills its own tab (since PR #44). The docked explorer is shown and hidden from the top-right file-tree icon or the command bar; it opens SFTP lazily on the terminal tab's authenticated connection, and its transfers belong to that tab. It has no expanded mode: detaching it opens an explorer tab at its current directory. Opening a file from either kind of explorer opens a document tab for the same target, or activates the one already showing that path in the space.

An explorer or document tab is a tab with a view (`files` or `document`). It opens its own file-only connection: no shell, authenticated through the vault with its own prompts, and its own session lifecycle (asleep, reconnect, close), independent of the terminal tab it came from. A document tab holds exactly one remote document. The document keeps the owner of the read that produced it; after a reconnection the tab reads the file again to learn the new connection's owner, and saving is allowed only while both owners match (`stores/file-document.ts`). Closing, retargeting, removing a space, quitting and updating all go through `useClosing`, which asks `useFileProtection` about drafts and transfers and applies the abandonment only once the closing succeeded.

## Consequences

- Each explorer or document tab authenticates again; it asks the user only for what the vault does not hold.
- Closing an SSH terminal ends its docked explorer and transfers, but never an explorer or document tab opened from it.
- Pinned explorer and document tabs reopen at their pinned path; a pinned terminal keeps its docked explorer's last directory (`remoteCwd`). No file contents are persisted.
- A shared connection pool between tabs of the same target is still out of scope.
