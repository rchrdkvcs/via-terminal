# In-app updates: feasibility

Investigated on 2026-10-07. This records the initial investigation. The repository was subsequently made public and the flow implemented; see [UPDATING.md](UPDATING.md) for the current behavior and operations. The observations below describe the pre-implementation state.

Via can offer an update indicator in the top-right title bar and install a new
version after a user click. Tauri 2 already supplies the native updater; the main
work is release delivery and a safe shutdown of terminal sessions.

## Current repository

- [Tauri configuration](../src-tauri/tauri.conf.json) bundles NSIS, MSI, DMG,
  AppImage and DEB, without updater artifacts or an endpoint.
- [Rust dependencies](../src-tauri/Cargo.toml), [frontend dependencies](../package.json)
  and [capabilities](../src-tauri/capabilities/default.json) contain no updater.
- [Release workflow](../.github/workflows/release.yml) explicitly disables
  `uploadUpdaterJson`. macOS builds use ad-hoc signing, verify the app in the DMG,
  and upload only that DMG. The matrix targets Windows x64, Linux x64 and macOS
  Apple Silicon; Intel Macs are outside the current release matrix.
- [TitleBar.vue](../src/components/shell/TitleBar.vue) already has a top-right
  action group suitable for the indicator.
- `gh repo view --json visibility,url` confirmed that `rchrdkvcs/via-terminal`
  is **private**. This is live repository state, not an inference from its README.
- [Release documentation](RELEASING.md) explicitly describes manual upgrades.
  [Privacy documentation](PRIVACY.md) currently promises no automatic update
  network requests.

## Native mechanism

Add the Rust/JavaScript updater plugin, register it, and grant its capabilities.
Configure `bundle.createUpdaterArtifacts`, an HTTPS endpoint and a public key.
Update signatures are mandatory; the private signing key belongs in CI secrets
with a separate secure backup. The API offers checking, download progress,
installation and a separate restart through the process plugin. Windows quits
the application during installation, so preparation must finish **before** calling
install. [Official updater guide](https://v2.tauri.app/plugin/updater/).

Use a released updater version at least 2.10.0 and verify compatibility with the
locked Tauri CLI/core. Its changelog documents Linux AppImage/DEB/RPM support and
Windows NSIS/MSI support. The general guide's artifact examples do not fully
reflect this newer bundle support.
[Tagged updater changelog](https://github.com/tauri-apps/plugins-workspace/blob/updater-v2.10.0/plugins/updater/CHANGELOG.md).

For DEB, installation uses package tools and can require privilege elevation.
AppImage needs a writable replacement location. macOS replaces the installed
application bundle; Windows invokes an installer. Test each packaging type,
including authorization prompts and restart behavior.
[Tagged updater implementation](https://github.com/tauri-apps/plugins-workspace/blob/updater-v2.10.0/plugins/updater/src/updater.rs).

Updater signatures and operating-system code signing solve different problems.
Ad-hoc macOS signing does not provide notarization or ordinary Gatekeeper trust.
For a smooth public distribution, prefer Developer ID signing and notarization;
otherwise validate the actual update and relaunch on a clean Mac rather than
assuming the current DMG signature check proves that path.
[macOS signing guide](https://v2.tauri.app/distribute/sign/macos/).

## Hosting and release delivery

Recommend a public repository dedicated to release artifacts, keeping the source
repository private. Alternatively, publish artifacts and metadata to HTTPS object
storage. Private GitHub release assets require authentication, so the existing
private repository cannot serve as an anonymous update endpoint. Do not embed a
shared repository access token in the app.
[GitHub release asset authentication](https://docs.github.com/en/rest/releases/assets?apiVersion=2022-11-28#get-a-release-asset).

`tauri-action@v1` supports updater JSON upload, signature upload, a destination
repository and explicit release tags. Provide both release ID and tag so URLs
point to versioned assets rather than mutable `latest` download paths. Confirm
that metadata selects the same installer type as the installed application.
[Action configuration](https://github.com/tauri-apps/tauri-action/tree/v1).

Recommended workflow changes:

1. Build and sign artifacts for every supported packaging type.
2. Keep the existing macOS verification and additionally verify the updater
   archive; uploading the DMG alone is insufficient.
3. Upload artifacts/signatures, then assemble and validate one complete manifest
   in a final job after all platform jobs succeed.
4. Expose the new update manifest only when all referenced downloads are ready.
   The current published-release trigger exposes a release before its builds
   finish; avoid directing clients to a partial release.
5. Start with one stable update channel. Treat prereleases explicitly, rather
   than assuming GitHub's latest-release URL selects them.

These are implementation recommendations, not requirements imposed by Tauri.

## Suggested user experience

Check once after startup, with a bounded timeout and an option to disable
automatic checks. Also offer a manual check in Settings. A background network
failure should leave the terminal usable; a manual check can explain the failure.

When an update exists, show a keyboard-accessible title-bar indicator with a
tooltip naming the version. Clicking opens release notes and the action
“Download and restart”. Show progress; do not force a restart in the background.
Before installation, explain that active local and SSH sessions will stop and
allow the user to postpone.

The shutdown path needs explicit persistence completion:

- [Spaces](../src/stores/spaces.ts) and [settings](../src/stores/settings.ts)
  debounce saves; expose an awaited flush instead of relying on a delay.
- Await pending [vault saves](../src/stores/vault-saves.ts), and resolve
  unsaved editor drafts before exit.
- [Rust exit handling](../src-tauri/src/lib.rs) closes sessions on `RunEvent::Exit`;
  verify updater termination paths, particularly Windows, and add an explicit
  preparation command if needed.

Keep the bundle identifier and data location unchanged. Verify vault, keychain,
settings and pinned-tab retention after upgrade. Terminal processes, temporary
tabs and scrollback are not persisted today and will not survive the restart.
Update the privacy documentation to disclose the update host and automatic
requests; terminal/vault content need not be sent.

## Rollout and verification

Existing installations lack updater code. Users must install one updater-enabled
release manually; subsequent releases can use the button. This follows from the
current dependencies and configuration, not from a remote setting we can enable.

Validate with two real packaged versions, A and B, on each target OS and installer
type. Cover valid upgrade, same version, offline mode, interrupted download,
invalid signature, missing platform artifact, denied elevation, active sessions,
pending saves, successful relaunch and retained data. Packaging/runtime validation
is still outstanding; this investigation ran no installation or update.

Feasibility is high. A prototype is small, but production readiness also needs
hosting, signing secrets, release automation and real-machine validation. Choose
the artifact host before wiring the endpoint into a distributed build.
