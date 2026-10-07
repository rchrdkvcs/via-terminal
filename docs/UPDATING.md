# Signed application updates

Via uses Tauri's [updater plugin](https://v2.tauri.app/plugin/updater/) and
[process plugin](https://v2.tauri.app/plugin/process/). The native updater verifies
packages with the public key in `src-tauri/tauri.conf.json`. No custom download or
installer implementation is used.

## User behavior

Installed release builds check once after startup, with a 15-second timeout.
Settings → General → Updates disables automatic checks and offers a manual check.
Development and browser previews do not check automatically. Checks use the
public endpoint:

`https://github.com/rchrdkvcs/via-terminal/releases/latest/download/latest.json`

An available version adds a button to the top-right title bar. It opens plain-text
release notes and an explicit download-and-restart action. A background check
failure is silent; a manual failure is visible and can be retried. Checks and
installation are serialized to avoid duplicate native operations.

The download has progress feedback and a two-minute timeout. Tauri verifies its
signature before any sessions are stopped. Next, Via saves mounted existing vault
drafts, drains queued and pending vault mutations, and flushes debounced settings
and organization writes. A failed write or an unsaved new vault draft blocks the
installation. Close the update dialog to resolve it, then retry; a verified
package need not download again.

After preparation succeeds, Via explicitly closes local and SSH sessions, invokes
the native installer, and restarts. Windows exits from the install call and its
installer restarts Via; macOS/Linux use the process plugin. If relaunch fails after
installation, the dialog offers restart without reinstalling. During installation,
the modal owns the keyboard and cannot be dismissed.

The bundle identifier and SQLite/keychain locations are unchanged. Settings,
vault records and pinned tabs remain; sessions, scrollback and temporary tabs do
not survive restart. OS authorization may still be required. The current macOS
release remains ad-hoc signed, without Apple notarization; updater signing does
not replace operating-system code signing.

## Signing key

The configured public key has a matching private key in the repository Actions
secret `TAURI_SIGNING_PRIVATE_KEY`. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is optional
and empty for the initial key. Keep a secure offline backup of the private key;
GitHub does not let you retrieve its secret later. The initial local copy was
created outside the repository in `~/.tauri/via-terminal/updater.key`, with private
filesystem permissions. Never commit or print it.

For an independent installation of this repository, create your own key with
`pnpm tauri signer generate -w <private-key-path>`, put only its public counterpart
in the configuration, and supply the private key/password as GitHub Actions
secrets. Existing clients trust the original public key: do not casually replace
it. Rotation requires a migration release signed by the old key that embeds the
new public key, followed by releases signed by the new key.

Local packaging also needs `TAURI_SIGNING_PRIVATE_KEY` (key path or content) and,
if applicable, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. These are environment
variables; Tauri does not read them from a `.env` file. Plain development and
frontend/Rust checks do not require the signing key.

## Release workflow

Create a new stable `vX.Y.Z` release from a commit containing this implementation.
The release workflow synchronizes all application versions from the tag and runs
quality checks. It then builds signed packages for:

- Windows x64: NSIS and MSI, with separate manifest targets.
- macOS Apple Silicon: DMG for initial installation and `Via.app.tar.gz` for updates.
- Linux x64: AppImage and DEB, with separate manifest targets.

The format-specific targets rely on updater 2.10 or newer; the dependency locks
currently resolve 2.13.1. Intel macOS and other architectures require explicit
matrix and manifest additions before distribution.

Platform jobs upload installers and `.sig` files, leaving `uploadUpdaterJson`
disabled in tauri-action. After every job succeeds, one final job builds and
validates `latest.json`, then uploads it. The validator requires all five targets,
nonempty uploaded assets, correctly structured signatures, matching release
versions and HTTPS URLs referring to the exact tag. Runtime signature verification
remains Tauri's responsibility.

`latest.json` is the completion marker. Re-running a completed release performs
quality checks but does not replace its artifacts. Failed, incomplete releases can
be retried. Preparing a draft with the manual workflow and publishing it once
complete avoids exposing a release before downloads are ready. If a release is
published first, startup checks can temporarily fail while it builds; they do not
interrupt Via. GitHub's latest-release endpoint selects stable releases; prerelease
builds do not publish the stable manifest.

Initial installations without the updater must manually install one version
containing it. This cannot be retrofitted into an already installed binary.

## Verification

Run `pnpm test:release` for manifest validation, plus the README quality checks.
Tests cover native updater results/failures, download-before-install ordering,
duplicate checks, retrying restart, persistence ordering and blocked preparation.

Before the first public updater rollout, test two packaged versions on each OS
and installer type: valid update and relaunch, retained SQLite/keychain data,
offline and interrupted download, invalid signature, denied elevation, active
sessions, a pending save, and a new unsaved vault draft. Local compilation and
mocked native API tests cannot replace those operating-system checks.

Implementation validation on 2026-10-07: 184 frontend tests, 39 Rust tests and four
manifest tests passed, together with formatting, lint, typechecking, frontend
build, Rust clippy and workflow actionlint. Frozen dependency installation was
checked with pnpm 10. A local macOS Apple Silicon release build produced the DMG,
updater archive and signature; both packaged apps passed codesign verification.
The real archive passed the same minisign verification used by Tauri, and an
altered copy was rejected. Browser checks covered the update indicator, release
notes, defer/reopen, progress and modal keyboard ownership. The review's restart
retry persistence finding was fixed and covered by a regression test.
