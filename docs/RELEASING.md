# Release checklist

Creating a GitHub Release (draft or published) for tag `vX.Y.Z` triggers GitHub Actions. Quality runs first, then Windows, macOS, and Linux installer jobs upload their artifacts onto **that same release**. Pushing a commit to `main` or pushing a tag by itself does not build installers. There is no in-app updater in this slice: do not produce or require an updater manifest or updater signing keys.

The workflow already requests `contents: write`. If asset upload fails with “Resource not accessible by integration”, set the repository Actions permission to allow GitHub Actions to create and update releases.

## Version and GitHub Release

- [ ] Merge the changes to release into `main`. For local builds, synchronize the version with `node .github/scripts/sync-release-version.mjs vX.Y.Z`.
- [ ] Create a GitHub Release with tag `vX.Y.Z` on that commit. A **draft** is enough: write the notes, save, and wait for the three installer jobs to attach files. Then publish.
- [ ] Do not create a second release for the same tag. Re-run the **Release** workflow (`workflow_dispatch` with the tag) if an asset is missing.

The release tag is the source of truth: both quality and installer jobs automatically synchronize `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the application entry in `src-tauri/Cargo.lock` before building. These changes are local to the runners; they do not create a commit. A forgotten version bump no longer blocks the release. Use a stable tag in the format `vX.Y.Z`.

## Build readiness

- [ ] Version and release notes are updated. Installers, binary, and install directories use the application name **Via**; GitHub release titles keep the product name **via terminal**.
- [ ] CI quality and compile jobs pass on Windows, macOS, and Linux with a locked dependency graph.
- [ ] Frontend build/tests/lint and Rust fmt/tests/clippy pass without warnings.
- [ ] The GitHub Release you created includes artifacts named **Via** (Linux `.deb` is lowercase `via`):
  - Windows x64: `Via_*_x64-setup.exe` and `Via_*_x64_en-US.msi` (installs to a `Via` directory, Start Menu folder `Via`)
  - macOS arm64 (Apple Silicon): `Via_*_aarch64.dmg` containing `Via.app`
  - Linux x64: `Via_*_amd64.AppImage` and `via_*_amd64.deb`
- [ ] macOS installers contain a Developer ID Application-signed, notarized app with a stapled ticket. The workflow verifies the app inside the DMG before upload. Windows binaries remain unsigned; SmartScreen warnings are expected.
- [ ] No updater manifest, updater endpoint, or updater signing key is required or published.

## Acceptance

- [ ] Every scenario in [ACCEPTANCE.md](ACCEPTANCE.md) is recorded against the release candidate on Windows, macOS, and Linux.
- [ ] Fresh install, upgrade by reinstalling over the previous version, uninstall, and retained-data behavior are verified on each OS as available.
- [ ] Database migration is tested from every supported prior schema and backed up before mutation.
- [ ] Performance results and the reference machine are recorded (OS, CPU, RAM, WebView, build hash).
- [ ] Known limitations include unsigned Windows binaries (SmartScreen), interactive SSH passwords, no process survival after exit, no in-app updater, and features outside V1.

## Security and privacy

- [ ] Dependency/advisory scan has no unexplained critical or high findings.
- [ ] Tauri capabilities and CSP are least-privilege.
- [ ] Synthetic secrets are absent from SQLite, logs, crash recovery, diagnostics, and exports.
- [ ] Unknown SSH fingerprints are never accepted automatically.
- [ ] Private vulnerability reporting is enabled and the repository URL in issue templates is valid.

## Publication and rollback

- [ ] Tag `vX.Y.Z` identifies the intended release commit; the workflow sets the installer version from this tag.
- [ ] Release notes link to upgrade notes, privacy behavior, and known issues, including unsigned Windows install steps and any legacy macOS Gatekeeper instructions.
- [ ] Downloaded artifacts are installed and launched on a clean machine for each target OS.
- [ ] After the three installer jobs finish, a human reviews the GitHub Release (publish it if it was still a draft). Collaborators download installers from that Release; the repository may remain private.
- [ ] Previous installers remain on older GitHub Releases for rollback; incompatible schema changes have a documented recovery path.

## Operator notes

Windows installers are not code-signed. macOS releases require Developer ID signing and Apple notarization. The running app does not check for updates; install a newer version by downloading it from the GitHub Release in a browser.

### Windows (unsigned NSIS `.exe` / MSI)

SmartScreen may warn that the publisher is unknown. Choose **More info**, then **Run anyway**. If the file is blocked after download, open **Properties**, check **Unblock**, and apply. The app is **Via** in the Start Menu and install directory.

### macOS (signed and notarized arm64 DMG)

A paid Apple Developer Program membership and a **Developer ID Application** certificate are required for distribution outside the App Store. Configure these repository Actions secrets before building a release:

| Secret                       | Value                                                               |
| ---------------------------- | ------------------------------------------------------------------- |
| `APPLE_CERTIFICATE`          | Base64-encoded `.p12` export of the certificate and its private key |
| `APPLE_CERTIFICATE_PASSWORD` | Password protecting that `.p12` export                              |
| `APPLE_SIGNING_IDENTITY`     | Full identity, e.g. `Developer ID Application: Example (TEAMID)`    |
| `APPLE_ID`                   | Apple account email used for notarization                           |
| `APPLE_PASSWORD`             | App-specific password, not the Apple account login password         |
| `APPLE_TEAM_ID`              | Apple Developer Team ID                                             |

Export the certificate with its private key from Keychain Access, protecting the `.p12` with a password. Encode it using `openssl base64 -A -in certificate.p12 -out certificate-base64.txt`, then put the output into the `APPLE_CERTIFICATE` secret. Never commit the certificate, private key, password, or encoded file. See [Tauri's signing guide](https://v2.tauri.app/distribute/sign/macos/) for certificate creation and notarization account setup.

Tauri imports the certificate, signs with the hardened runtime, submits the app to Apple, and staples the notarization ticket. The workflow fails if credentials are missing, notarization fails, or the app inside the DMG fails signature, stapled-ticket, or Gatekeeper validation. The DMG is uploaded only after validation.

Create a new version/tag containing this workflow and rebuild the installer. Re-running an old tag checks out its old workflow files/configuration and does not apply this fix. Existing downloads are not changed by a new release.

Download the DMG through a browser on a clean Apple Silicon Mac, drag **Via.app** into **Applications**, eject the DMG, and launch the installed app. Confirm that Gatekeeper permits launch (the normal first-launch Internet download confirmation may still appear). Repeat without network access to check the stapled ticket. CI checks do not replace this clean-machine acceptance test.

For older ad-hoc signed downloads showing “Apple could not verify … is free of malware”, if you trust the download source: click **Done**, then open **System Settings → Privacy & Security → Open Anyway**, authenticate, and confirm **Open**. See [Apple's instructions](https://support.apple.com/en-au/102445). Older builds may be named **via terminal.app**. Prefer the new signed release when available.

For a local, non-distributed build without a certificate, use `APPLE_SIGNING_IDENTITY=- pnpm tauri build --bundles dmg`. This ad-hoc signature still requires a Gatekeeper override after browser download. `pnpm tauri dev` does not require release signing credentials.

### Linux (AppImage / `.deb`)

Make the AppImage executable (`chmod +x`) before running it. Install the `.deb` with the distribution package manager. The desktop entry and binary are **Via**.
