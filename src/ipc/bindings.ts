// Generated from the Rust wire types by `UPDATE_BINDINGS=1 cargo test --manifest-path src-tauri/Cargo.toml bindings`. Do not edit.

export type AppError = { code: string, message: string, };

export type Bootstrap = { layout: Layout, settings: Settings, vault: VaultView, shells: Array<Shell>, systemShell: string | null, platform: string, };

export type SwipeRegion = { x: number, y: number, width: number, height: number, };

export type SwipePhase = "start" | "update" | "end" | "cancel";

export type TrackpadSwipeEvent = { phase: SwipePhase, dx: number, dy: number, t: number, };

export type Settings = { theme: Theme, fontFamily: string, fontSize: number, lineHeight: number, cursorStyle: CursorStyle, cursorBlink: boolean, scrollback: number, copyOnSelect: boolean, defaultShell: string | null, saveQuickConnect: boolean, confirmCloseRunning: boolean, 
/**
 * Check the public release endpoint once after startup.
 */
checkForUpdates: boolean, };

export type Theme = "light" | "dark" | "system";

export type CursorStyle = "block" | "underline" | "bar";

export type Layout = { activeSpaceId: string | null, sidebar: Sidebar, spaces: Array<PersistedSpace>, };

export type Sidebar = { width: number, visible: boolean, };

export type PersistedSpace = { id: string, name: string, icon: string, defaultShell: string | null, pinned: Array<Entry>, };

export type Entry = { "kind": "tab" } & Tab | { "kind": "split" } & Split | { "kind": "folder", id: string, name: string, open: boolean, rows: Array<Row>, };

export type Row = { "kind": "tab" } & Tab | { "kind": "split" } & Split;

export type Tab = { id: string, title: string | null, remoteCwd?: string | null, view?: TabView, target: Target, };

/**
 * What a remote tab shows instead of its terminal. A tab without a view is a terminal.
 */
export type TabView = { "kind": "files", path: string | null, } | { "kind": "document", path: string, };

export type Split = { id: string, direction: Direction, sizes: Array<number>, tabs: Array<Tab>, };

export type Direction = "horizontal" | "vertical";

export type Target = { "kind": "local", shell: string | null, cwd: string | null, } | { "kind": "host", hostId: string, } | { "kind": "quick", address: string, port: number | null, username: string | null, };

export type Size = { cols: number, rows: number, };

export type Shell = { path: string, name: string, args: Array<string>, };

export type SessionState = "connecting" | "verifying" | "authenticating" | "ready" | "exited" | "failed" | "disconnected";

/**
 * Why a session failed, so the interface can tell what the user can do about it.
 */
export type FailureReason = "unreachable" | "authentication" | "hostKey" | "cancelled" | "other";

export type Prompt = { "kind": "hostKey", address: string, port: number, algorithm: string, fingerprint: string, previousFingerprint: string | null, } | { "kind": "authentication", address: string, username: string | null, canRemember: boolean, } | { "kind": "username", address: string, } | { "kind": "password", username: string, address: string, canRemember: boolean, retry: boolean, } | { "kind": "passphrase", keyLabel: string, canRemember: boolean, retry: boolean, } | { "kind": "keyboardInteractive", name: string, instructions: string, fields: Array<PromptField>, };

export type PromptField = { label: string, echo: boolean, };

export type PromptAnswer = { "kind": "credential", credential: CredentialChoice, } | { "kind": "authentication", username: string, password: string, remember: boolean, } | { "kind": "accept" } | { "kind": "cancel" } | { "kind": "text", value: string, remember: boolean, } | { "kind": "fields", values: Array<string>, };

export type CredentialChoice = { "kind": "password", username: string, } | { "kind": "identity", id: string, } | { "kind": "key", id: string, username: string, };

export type LocalTarget = { shell: string | null, cwd: string | null, };

export type TerminalOutputEvent = { sessionId: string, dataBase64: string, };

export type SessionStateEvent = { sessionId: string, state: SessionState, message: string | null, exitCode: number | null, reason: FailureReason | null, };

export type SessionPromptEvent = { sessionId: string, promptId: string, prompt: Prompt | null, };

export type VaultChangedEvent = { sessionId: string, hostId: string | null, };

export type VaultView = { effective: { [key in string]: Effective }, revision: number, passwords: Array<string>, passphrases: Array<string>, secretsAvailable: boolean, groups: Array<Group>, hosts: Array<Host>, identities: Array<Identity>, keys: Array<Key>, knownHosts: Array<KnownHost>, };

export type VaultSnapshot = { passwords: Array<string>, passphrases: Array<string>, secretsAvailable: boolean, groups: Array<Group>, hosts: Array<Host>, identities: Array<Identity>, keys: Array<Key>, knownHosts: Array<KnownHost>, };

export type VaultData = { groups: Array<Group>, hosts: Array<Host>, identities: Array<Identity>, keys: Array<Key>, knownHosts: Array<KnownHost>, };

export type Group = { id: string, parentId: string | null, name: string, position: number, defaults: Defaults, };

export type Defaults = { username: string | null, port: number | null, identityId: string | null, };

export type Host = { id: string, groupId: string | null, label: string, address: string, port: number | null, credential: HostCredential, tags: Array<string>, notes: string, createdAt: number, lastConnectedAt: number | null, };

export type HostCredential = { "kind": "inherit", username: string | null, key: string | null, } | { "kind": "identity", id: string, } | { "kind": "key", id: string, username: string | null, } | { "kind": "password", username: string | null, };

export type Identity = { id: string, label: string, username: string, keyId: string | null, };

export type Key = { id: string, label: string, algorithm: string, fingerprint: string, publicKey: string, encrypted: boolean, createdAt: number, };

export type KnownHost = { id: string, address: string, port: number, algorithm: string, fingerprint: string, addedAt: number, };

export type Source = { "kind": "host" } | { "kind": "identity", "id": string } | { "kind": "group", "id": string } | { "kind": "default" };

export type Sourced<T> = { value: T, from: Source, };

export type Effective = { username: Sourced<string> | null, port: Sourced<number>, identityId: Sourced<string> | null, keyId: Sourced<string> | null, };

export type SecretUpdate = { "action": "keep" } | { "action": "clear" } | { "action": "set", "value": string };

export type HostInput = { id: string | null, groupId: string | null, label: string, address: string, port: number | null, credential: HostCredential, tags: Array<string>, notes: string, password: SecretUpdate, };

export type GroupInput = { id: string | null, parentId: string | null, name: string, defaults: Defaults, };

export type IdentityInput = { id: string | null, label: string, username: string, keyId: string | null, password: SecretUpdate, };

export type KeyImport = { label: string, privateKey: string, passphrase: string | null, rememberPassphrase: boolean, };

export type QuickTarget = { address: string, port: number | null, username: string | null, };

export type Mutation = { vault: VaultView, id: string | null, };

/**
 * Endpoint and account behind a remote explorer; documents and transfers keep the one that
 * produced them. The interface only compares it for equality.
 */
export type RemoteOwner = string;

export type FileRequest = { "operation": "list", path: string, } | { "operation": "read", path: string, } | { "operation": "save", document: RemoteText, original: string, overwrite: boolean, } | { "operation": "create", parent: string, name: string, directory: boolean, } | { "operation": "move", path: string, destination: string, } | { "operation": "delete", path: string, } | { "operation": "chmod", path: string, permissions: number, } | { "operation": "transfer" } & TransferPlan | { "operation": "cancel", id: string, } | { "operation": "resolve", id: string, choice: Collision, all: boolean, };

/**
 * Answer to a request: a listing, a document, or nothing for commands.
 */
export type FilesReply = Listing | RemoteText | null;

export type TransferPlan = { id: string, owner: RemoteOwner, direction: TransferDirection, sources: Array<string>, destination: string, completedSources?: Array<string>, directories?: { [key in string]: string }, };

export type Listing = { owner: RemoteOwner, path: string, entries: Array<RemoteEntry>, };

export type RemoteText = { owner: RemoteOwner, path: string, resolvedPath: string, content: string, permissions: number | null, uid: number | null, gid: number | null, };

export type EntryKind = "file" | "directory" | "link" | "other";

export type RemoteEntry = { name: string, path: string, kind: EntryKind, targetKind: EntryKind | null, size: number, modified: number | null, permissions: number | null, };

export type TransferDirection = "upload" | "download";

export type Collision = "replace" | "skip" | "keepBoth";

export type NativeTransferState = "running" | "conflict" | "completed" | "failed" | "cancelled";

export type TransferEvent = { sessionId: string, id: string, direction: TransferDirection, state: NativeTransferState, path: string, bytes: number, total: number, message: string | null, skipped: Array<string>, completedSources: Array<string>, directories: { [key in string]: string }, };
