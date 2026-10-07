# via terminal

A native terminal where **spaces** organize **tabs**, and a **vault** remembers where tabs can connect. The product is **via terminal**; the shipped application is **Via**.

## Organization

**Space**:
A named context of tabs with its own icon and optional default shell. Spaces never own hosts or credentials.
_Avoid_: Workspace, project, profile

**Tab**:
One terminal, remote explorer or remote document bound to one target, living in exactly one place in one space.
_Avoid_: Session (the live part), pane, window

**Row**:
What the sidebar lists: a tab or a split view.
_Avoid_: Node, item, entry

**Split view**:
Two to four tabs shown side by side as a single row. Each member keeps its own session.
_Avoid_: Split group, pane tree, layout

**Pinned tab**:
A tab kept across restarts in the pinned area of its space. It always reopens where it was pinned: a local shell in its directory, the docked remote explorer of an SSH terminal in its remote directory, a remote explorer or remote document tab at its path. Navigating inside it never moves the pin.
_Avoid_: Favorite, bookmark

**Temporary tab**:
A tab below New tab that is never restored after exit.
_Avoid_: Unpinned tab, open tab

**Folder**:
A named, one-level container of pinned rows.
_Avoid_: Group (that word belongs to the vault)

**Asleep**:
The state of a tab without a session. Only an explicit activation wakes it.
_Avoid_: Stopped, restorable, closed

## Connecting

**Target**:
What a tab connects to: a local shell or a host.
_Avoid_: Resource, destination, profile

**Local shell**:
A shell executable detected on this machine, with an optional working directory.
_Avoid_: Local profile

**Session**:
The live process or SSH connection behind a tab; a remote explorer or remote document tab has one without a shell. A tab has at most one session at a time; reconnecting replaces it.
_Avoid_: Connection (too vague), terminal

**Command bar**:
The single place to open a target, search the vault or run an action.
_Avoid_: Palette, picker, new-tab dialog

**Quick connect**:
Connecting to an address typed by hand. A successful authentication saves it as a host.
_Avoid_: Ad-hoc connection

## Remote files

**Remote explorer**:
The file panel showing files on a remote target. It sits beside an SSH terminal or fills its own tab, which opens its own file-only connection.
_Avoid_: Finder, local explorer, file workspace

**Owner**:
The endpoint and account behind a remote explorer. Documents and transfers keep the owner that produced them and are never saved or retried through another one.
_Avoid_: Identity (that word belongs to the vault), server, connection

**Transfer**:
An upload or download of files and directories started from a remote explorer. A dropped upload first appears as a preparation while its files are staged locally. A failed transfer can be retried after reconnecting.
_Avoid_: Job, copy, sync

**Remote document**:
A remote text file opened from a remote explorer, shown in its own tab in place of a terminal; a tab holds exactly one. Its unsaved changes belong to that document until saved or explicitly discarded.
_Avoid_: Buffer, local file

## Vault

**Vault**:
The application-wide library of hosts, groups, identities, keys and known hosts, shared by every space. It never reads the system SSH configuration.
_Avoid_: Keychain (that is the OS store), resources

**Host**:
A saved SSH destination: an address with optional port, authentication choice, tags and notes. Its **host credential** either inherits the group defaults or chooses a vault identity, a vault key with its username, or a username and password. An explicit host credential replaces group authentication defaults; the port can still be inherited. A selected identity supplies its username and credential together. Records saved before the host credential existed keep their effective values: a username or key they stored on top of group defaults stays an override of that part only, and the group identity still applies. Deleting a selected identity or key leaves its username and asks for a password.
_Avoid_: Server, resource, connection

**Group**:
A nested folder of hosts whose defaults (username, port, identity) are inherited unless overridden.
_Avoid_: Folder (that word belongs to spaces), tag

**Identity**:
A reusable username with its credential, referenced by hosts and groups.
_Avoid_: Account, user, profile

**Key**:
A private key held by the vault, imported or generated.
_Avoid_: Identity file, certificate

**Known host**:
A server key fingerprint the user accepted.
_Avoid_: Trusted host, fingerprint (the value, not the record)

**Secret**:
A password, passphrase or private key. Secrets are only readable through the OS keychain.
_Avoid_: Credential (covers non-secret usernames too)
