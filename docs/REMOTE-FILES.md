# Remote files — design specification

Status: accepted and implemented. Platform acceptance scenarios below remain a manual release gate.

## Explorer and entry points

- Browse remote files only; upload and download connect the remote explorer to local file selection without a local browsing panel.
- Attach a resizable remote explorer to the SSH terminal tab.
- Allow the remote explorer to fill Via's content area, temporarily hiding the terminal. Returning restores the shared layout; the terminal keeps running while hidden.
- Navigate independently from the terminal's working directory.
- Open the explorer for the active SSH tab through a file-tree icon at the top right or an action in the command bar.
- First navigation starts at the remote account's home directory; each tab retains its last visited directory.
- In split views, the explorer follows the selected terminal, with separate directory and document state per tab. Expanded mode clearly identifies the remote target.
- Apply Via's existing keyboard-access requirement to the explorer, document editing and file operations. The command bar provides opening without a new global shortcut.

## File operations and transfers

- Create files and directories, rename, move and delete remote entries.
- Display and edit Unix permissions through a simple interface. Use the connected account's rights; report access failures without automatic sudo elevation.
- Upload and download files and entire directories, with multiple selection, drag-and-drop upload and visible progress.
- On transfer collisions, ask whether to replace, skip or keep both, with an option to apply the answer to the remaining collisions in that transfer.
- Keep-both naming must produce a free destination name without overwriting another entry. Cancellation never rolls back already completed files.
- Deletion is permanent, including non-empty directories, and requires confirmation identifying the path and the permanent nature of the operation.
- Identify symbolic links and allow navigation to their targets. Deleting a link removes only the link; recursive transfers do not automatically follow symbolic links.
- Skip symbolic links during recursive transfers and list skipped links in the transfer report.
- A dropped upload shows a cancellable preparation, with progress, while its files are copied to local staging; it then continues as the upload. Cancelling or closing its tab discards the staging.
- Replacing a directory with a file, or a file or link with a directory, is refused with a message suggesting Skip or Keep both.
- Remote names follow POSIX: entries containing a backslash are listed, transferred and deleted like any other. Downloads still refuse names the local platform cannot represent.
- Uploads replacing a file keep its permission bits, without setuid, setgid or sticky. New uploads selected with the native picker keep local permission bits without group or other write. Web drag-and-drop provides bytes but no original Unix mode: new dropped files use ordinary local staging permissions and do not retain executable bits. Use the picker to upload executable scripts, or explicitly set remote permissions after dropping.
- Allow individual transfer cancellation and best-effort cleanup of incomplete temporary files. Report leftovers when cleanup cannot be completed; completed files remain at the destination.

## Documents and saving

- Read and edit text with syntax highlighting and explicit saving.
- Keep multiple documents open, with an indicator for unsaved changes.
- Edit UTF-8 text files up to 5 MB (5,000,000 bytes). Binary, unsupported-encoding and larger files remain downloadable, with an explanation when editing is unavailable. Preserve existing line endings and any UTF-8 BOM; limit actual bytes read, not just the initial reported size.
- On closing a modified document or its terminal tab, offer Save / Discard / Cancel. Hiding the panel or changing tabs preserves documents and unsaved edits.
- Failed or canceled saving does not complete an attempted close. Choosing Discard loses nothing until every later question (another document, stopping transfers, closing a running session) is confirmed and the closing succeeds; edits made meanwhile are asked about again. If disconnected, saving requires reconnection; the user can still explicitly discard or cancel closing.
- Detect remote changes before saving and require an explicit decision to reload or overwrite rather than silently replacing a changed file.
- Save through an exclusive temporary file in the destination directory, then safe replacement. Preserve Unix permissions, owner and group; refuse saving if these guarantees or safe replacement cannot be met, and keep the edits.
- The first version does not guarantee preservation of ACLs, extended attributes or hard-link relationships. Document this limitation; editing files that depend on these properties is outside this version's supported scope. Do not imply these properties can always be detected through SFTP.
- Opening a symbolic link to text edits its resolved target, clearly showing the actual path. Preserve the link and verify it still resolves to the same target before saving; block saving if the target changed.
- Remote-change detection does not lock out other writers. Compare the remote content with the originally read content before saving, but do not claim the verification and replacement are one atomic operation.
- Keep unsaved edits after a failed save. If the replacement response was lost, verify the remote contents after reconnecting before deciding whether to retry.

## SSH lifecycle and persistence

- Open SFTP lazily on the authenticated SSH connection, without a second login. If the subsystem is unavailable, explain the failure while keeping the terminal usable.
- Transfers continue while the explorer is hidden or another tab is selected. Closing their owning tab requires confirmation and cancels its transfers.
- Ending the remote shell also ends SFTP and stops transfers. Keep unsaved documents in memory so they can be retried after reconnection and remote-file verification.
- On interrupted transfers, report failure and allow retry after reconnection. Retry restarts the interrupted file from the beginning; there is no byte-offset resumption in the first version.
- Across application restarts, retain the last remote directory of pinned tabs but no file contents on disk. Quitting with unsaved edits or active transfers requires confirmation. No remote connection starts automatically at launch.
- Changing an existing tab's target or deleting its space must apply the same protections as closing it. Never offer to save an old target's document through a new target's connection.

## Existing constraints

- Tabs currently represent terminals; this scope keeps the explorer attached to a terminal tab.
- Via owns SSH authentication, host-key verification and credentials through its embedded SSH client and global vault.
- At the start of this feature, Via had no SFTP subsystem or file editor.
- The product specification now includes this remote explorer.

## Interview record

Round 1: remote explorer only; resizable panel beside the terminal with an expansion control; text reading/editing, syntax highlighting and explicit save accepted.

Round 2: expanded explorer fills the content area while the terminal keeps running; independent navigation; basic file operations; multiple open documents with unsaved indicators; transfers of files and directories with multiple selection, drag-and-drop upload and progress accepted.

Round 3: recommendations Q9–Q14 accepted: permission editing without privilege elevation; explicit collision choices; unsaved-change protection; remote-change detection before save; transfers continue across panel hiding/tab switching but are canceled on confirmed tab closure; interrupted operations retain edits and support retry from the beginning. Entry points are a file-tree icon at the top right and the command bar.

Round 4: recommendations Q15–Q20 accepted: remote home then per-tab last directory; explorer follows selected terminal in splits; UTF-8 editing limited to 5 MB; only pinned-tab directory survives restart, with no cached file contents; confirmed permanent recursive deletion; visible symbolic links, navigation to targets and no automatic following in recursive transfers.

Round 5: recommendations Q21–Q25 accepted: lazy SFTP on the authenticated SSH connection; shell exit ends SFTP while retaining unsaved documents in memory; safe replacement required for saves; individual transfer cancellation with best-effort cleanup; skipped symbolic links listed in recursive transfer reports.

Round 6: recommendations Q26–Q27 accepted: preserve Unix mode, owner and group or refuse the save; ACLs, extended attributes and hard-link relationships are outside supported editing guarantees; editing through symbolic links resolves, displays and verifies the target while preserving the link.

## Verified implementation constraints

- The current authenticated `russh` handle can open an additional session channel for the SFTP subsystem. It is currently owned by the terminal session actor, which must expose file operations while keeping SFTP errors separate from shell failures.
- Standard SFTP v3 rename cannot safely overwrite an existing destination. Safe replacement requires a supported mechanism such as `posix-rename@openssh.com`; deleting the original before renaming is not a safe fallback. See the [SFTP v3 specification](https://www.openssh.org/txt/draft-ietf-secsh-filexfer-02.txt) and [OpenSSH extensions](https://raw.githubusercontent.com/openssh/openssh-portable/master/PROTOCOL).
- Temporary replacement does not automatically preserve ownership or Unix mode. Apply and verify the original mode, owner and group before replacing the original. Replacing also requires write access to its directory, even when in-place writing would be allowed.
- Replacing a symbolic-link path replaces the link itself; use the verified resolved target for document saves.
- A lost response after replacement leaves the save outcome uncertain. Keep the draft and verify remote contents after reconnection before retrying.
- Comparing remote contents before replacement improves conflict detection but cannot prevent another writer racing the replacement.

## Acceptance scenarios

Run these scenarios in the real application on supported platforms, using controlled SFTP servers and fault injection for network failures.

- Open the explorer through the top-right icon and command bar on an authenticated SSH tab: no second authentication; terminal remains usable. On a server without SFTP, show an explorer error while the shell still works.
- Resize, expand and restore the explorer while the terminal produces output: preserve the terminal session and layout. In a split view, switch the focused terminal and verify the displayed server, directory and documents all match.
- Navigate away from home, run a different `cd` in the terminal, hide the panel and return: explorer navigation remains independent. Restart with a pinned tab: recover its directory only after explicit connection, with no restored document contents.
- Create a file and directory, rename and move entries, change Unix permissions, then delete a non-empty directory: verify remote results and confirmation of permanent deletion. Repeat an operation without sufficient rights: display the error without sudo.
- Upload and download multiple files and a nested directory. Exercise replace, skip and keep both, including applying a collision answer to the transfer. Skipped symbolic links appear in the report; a keep-both choice never overwrites an existing name.
- Cancel a transfer, then repeat with a network cut: clean up incomplete temporary files when possible, report unresolved leftovers, retain completed files and retry the interrupted file from the beginning.
- Open multiple UTF-8 documents, edit and save: preserve line endings, BOM, Unix mode, owner and group. Test a binary file, invalid UTF-8 and a file exceeding 5,000,000 bytes, including one that grows during reading: editing is refused with a reason, download remains available.
- Close a dirty document, close its tab, change the tab's target, delete its space and quit Via: each path protects edits; Cancel leaves them available; a failed Save does not close the document. Hiding the panel and changing tabs require no discard.
- Modify a document externally before saving: block silent overwrite and offer reload or explicit overwrite. Open a symbolic link, change its target externally, and attempt saving: refuse; with the original target unchanged, save the target and preserve the link.
- Attempt saving where safe replacement or metadata preservation is unavailable: keep the original intact and edits available, and explain the failure. Inject failures during temporary writing and after replacement but before its response: do not claim success without verification.
- Start transfers and change tabs: transfers continue. Confirm closing their owner or run `exit`: transfers stop. Network interruption retains dirty documents; reconnection checks the remote file before retrying.
- Perform opening, navigation, file operations, document editing, expansion and transfer cancellation with the keyboard; ensure focus is visible and terminal shortcuts remain available when the terminal has focus.

## Implementation verification (2026-10-07)

- Public SFTP service tests cover bounded UTF-8 reads, safe replacement and metadata, conflicts, changed link targets, ordinary operations, streamed transfers, collisions/cancellation, recursive empty directories, completed-file retry, chosen-directory retry and endpoint/account ownership. An in-process SSH server verifies channel reuse, shell usability and shell exit.
- Explorer store tests cover drafts edited during saving/reloading, stale reads/listings after disconnect, endpoint/account changes and rejected transfer startup after tab release.
- Sanitized browser fixture (`.ai/remote-files-fixture.js`): top-right opening, 40% initial width, text opening/editing, Save/Discard/Cancel dialog, expanded/normal layout and macOS document save shortcut exercised. [Expanded explorer evidence](../.ai/evidence/remote-files/expanded.png).
- Native development build compiled and launched without a reported startup error. Windows/Linux, native file pickers and OS drag/drop, application quit gestures, unsupported real servers and real network fault injection remain manual acceptance gates. The browser host became unavailable before command-bar gestures could be verified.

Review corrections (2026-10-07, second pass): Discard is applied only after a successful close; SFTP opening no longer pauses the shell reader (regression: an in-process server floods the shell before confirming SFTP); POSIX names with backslashes are listed and deleted; uploads keep or set permission bits as above; dropped files show a cancellable preparation; staging cleanup is explicit and cannot block startup; Save is never offered for another owner; text fields and the document editor keep their own shortcuts. Wire replies are typed per operation.

Retry state includes source-to-directory destinations so “Conserver les deux” continues in the selected folder. Retained documents and transfers carry the actual authenticated endpoint/account identity; native operations reject use on a different identity. These values and file contents remain in memory.

Automated checks after integration: 220 frontend tests, 67 Rust tests and four release-script tests passed; production build, typecheck, lint, formatting and Clippy passed. Regression coverage includes cancellation preserving drafts, SFTP opening during a shell flood, drop preparation lifecycle, navigation retaining focus and accessible document navigation. Final independent review is tracked in the [review follow-up](../.ai/remote-files-review-followup.md); native acceptance scenarios above remain open.

After a connection interruption, a late terminal event retains the failed, retryable row and adds any cleanup warning. A late completion does not silently relabel the interrupted operation as successful; retry uses completed-source progress, and an entirely completed selection finishes without copying or counting the files again.
