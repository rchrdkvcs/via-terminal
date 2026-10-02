# Acceptance scenarios

Each scenario is run in the real application, not only through unit tests. The behavior they verify is described in [PRODUCT.md](PRODUCT.md).

## Opening things

- From a fresh launch, Ctrl+Shift+T, type part of a host label, Enter: a temporary tab appears at the top of the temporary area and connects.
- Type `user@10.0.0.5:2222` and press Enter: the pane shows the connection steps. After authentication, the host appears in the vault with that user and port.
- Turn off quick-connect saving in settings: a successful quick connect leaves the vault unchanged.
- Ctrl+Shift+L on a running tab, choose another target: the same row now connects there, and its old session is closed.
- With nothing open, the content shows the default shell and recent hosts. One click opens any of them.

## SSH

- Unknown server: the pane shows the fingerprint. Trust opens the session and the key appears under Known hosts; Cancel fails the tab with « Clé du serveur refusée ».
- Changed server key: a warning shows both fingerprints, and replacing the key requires the explicit destructive button.
- Wrong stored password: the pane asks again and marks the retry.
- Remember: after a successful login, the password shows as « Mot de passe enregistré » on the host, and the next connection asks nothing.
- A key protected by a passphrase: the pane asks for the passphrase, and can remember it.
- A one-time code challenge: the pane shows its fields. Nothing is stored.
- Stop the server while connected: the tab keeps its output and shows Reconnect. Enter reconnects in the same row, and the scrollback stays.
- `exit` in a remote shell ends the session with its exit code.

## Tabs, splits, folders

- Pin a running tab with Ctrl+Shift+D: it moves above the divider without restarting.
- Restart Via: pinned tabs come back asleep and dimmed, temporary tabs are gone, and nothing connects until clicked.
- Close a running pinned tab: it goes to sleep. Close it again: it is removed, and Undo restores it in place.
- A temporary local shell that runs `exit` disappears; one that fails to start stays with Retry.
- In Git Bash, PowerShell, cmd and zsh, `cd` somewhere, pin the tab, restart Via and wake it: the shell opens in that folder, with the user's prompt unchanged.
- Rename the tab of a quick-connect host: the host takes that name in the vault and the command bar.
- Open and close a folder: its rows slide in and out instead of appearing at once.
- Drag a row onto the right edge of the content: a split view appears as one row. Add members up to four, and the fifth is refused.
- Detach a member: it becomes the row right after the split, and its session keeps running.
- Drag rows before and after others, and into and out of folders. Dropping on an invalid target changes nothing.
- Every action above is also available from the row menu or the command bar (Ctrl+Shift+P).

## Spaces

- Create a space with a name, an icon and a shell: new local tabs use its shell.
- Ctrl+1…9, the switcher and Ctrl+wheel all switch spaces, and sessions in other spaces keep running.
- Delete a space with running tabs: a confirmation names how many will close. The last space cannot be deleted.
- Move a tab to another space from its menu: it keeps its session.

## Vault

- Create a host with only an address. Add a group with a default user and port, and move the host into it: the placeholders show the inherited values and where they come from.
- An identity shared by two hosts: changing its password affects both hosts' next connection.
- Generate an Ed25519 key, copy its public key, and attach the key to a host.
- Import an encrypted OpenSSH key, by pasting it and by choosing the file.
- Delete a key in use: the hosts that used it lose the reference and keep working with a password.
- Without a keychain (Linux without Secret Service), the secret fields explain why they are disabled.

## Terminal

- Unicode, resize, Ctrl+C, and sustained output while switching spaces: the interface stays responsive.
- The shell receives Ctrl+W, Ctrl+D, Ctrl+L, Ctrl+K, Ctrl+T and Ctrl+B.
- Copy with Ctrl+Shift+C, paste multiline text with Ctrl+Shift+V, find text with Ctrl+Shift+F, and open a link with Ctrl+click.

## Privacy

- After remembering a password, it cannot be found with `grep` in `via.sqlite`, and it never appears in the interface's devtools snapshot.
