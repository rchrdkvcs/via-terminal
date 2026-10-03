# Release checklist

Publishing a GitHub Release (stable or prerelease) for tag `vX.Y.Z` triggers GitHub Actions. Saving a draft does not trigger a build; use the manual **Release** workflow with its tag to prepare draft assets. Quality runs first, then Windows, macOS, and Linux installer jobs upload their artifacts onto **that same release**. Pushing a commit to `main`, opening or updating a pull request, or pushing a tag by itself does not build installers. CI keeps the frontend build, tests, lint, and Rust quality checks. There is no in-app updater in this slice: do not produce or require an updater manifest or updater signing keys.

The workflow already requests `contents: write`. If asset upload fails with “Resource not accessible by integration”, set the repository Actions permission to allow GitHub Actions to create and update releases.

## Version and GitHub Release

- [ ] Merge the changes to release into `main`. For local builds, synchronize the version with `node .github/scripts/sync-release-version.mjs vX.Y.Z`.
- [ ] Create a GitHub Release with tag `vX.Y.Z` on that commit. Publish it to start the three installer jobs. To attach files before publication, save a **draft**, run the **Release** workflow manually with its tag, wait for the jobs, then publish. Publication also triggers a build, replacing assets with the same names.
- [ ] Do not create a second release for the same tag. Re-run the **Release** workflow (`workflow_dispatch` with the tag) if an asset is missing.

The release tag is the source of truth: both quality and installer jobs automatically synchronize `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, and the application entry in `src-tauri/Cargo.lock` before building. These changes are local to the runners; they do not create a commit. A forgotten version bump no longer blocks the release. Use a stable tag in the format `vX.Y.Z`.

## Build readiness

- [ ] Version and release notes are updated. Installers, binary, and install directories use the application name **Via**; GitHub release titles keep the product name **via terminal**.
- [ ] CI quality checks pass on Windows with a locked dependency graph; the release installer jobs build Windows, macOS, and Linux.
- [ ] Frontend build/tests/lint and Rust fmt/tests/clippy pass without warnings.
- [ ] The GitHub Release you created includes artifacts named **Via** (Linux `.deb` is lowercase `via`):
  - Windows x64: `Via_*_x64-setup.exe` and `Via_*_x64_en-US.msi` (installs to a `Via` directory, Start Menu folder `Via`)
  - macOS arm64 (Apple Silicon): `Via_*_aarch64.dmg` containing `Via.app`
  - Linux x64: `Via_*_amd64.AppImage` and `via_*_amd64.deb`
- [ ] macOS installers contain an ad-hoc signed app, without a Developer ID certificate or Apple notarization. The workflow verifies the app inside the DMG before upload. Windows binaries remain unsigned; SmartScreen warnings are expected.
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
- [ ] Release notes link to upgrade notes, privacy behavior, and known issues, including unsigned Windows install steps and the macOS Gatekeeper override instructions below.
- [ ] Downloaded artifacts are installed and launched on a clean machine for each target OS.
- [ ] After the three installer jobs finish, a human reviews the GitHub Release (publish it if it was still a draft). Collaborators download installers from that Release; the repository may remain private.
- [ ] Previous installers remain on older GitHub Releases for rollback; incompatible schema changes have a documented recovery path.

## Operator notes

Windows installers are not code-signed. macOS releases use ad-hoc signing and require manual Gatekeeper approval on first launch after download. No paid Apple Developer membership or Apple Actions secrets are required. The running app does not check for updates; install a newer version by downloading it from the GitHub Release in a browser.

### Windows (unsigned NSIS `.exe` / MSI)

SmartScreen may warn that the publisher is unknown. Choose **More info**, then **Run anyway**. If the file is blocked after download, open **Properties**, check **Unblock**, and apply. The app is **Via** in the Start Menu and install directory.

### macOS (ad-hoc signed arm64 DMG)

The release workflow uses `APPLE_SIGNING_IDENTITY=-` to produce an ad-hoc signature without a developer certificate. It does not submit the app for notarization. Before uploading the DMG to the release, CI mounts it, checks that it contains **Via.app**, and verifies the app's signature with `codesign`. Apple's notarization and Gatekeeper acceptance checks are not part of this build.

Download the DMG on an Apple Silicon Mac, drag **Via.app** into **Applications**, eject the DMG, and launch the installed app. If macOS reports that Apple could not verify the app, and you trust the download source, click **Done**, then open **System Settings → Privacy & Security → Open Anyway**, authenticate, and confirm **Open**. See [Apple's instructions](https://support.apple.com/en-au/102445). Verify this flow on a clean Mac; CI signature checks do not replace an installation and launch test.

Create a new version/tag containing these changes to build the updated installer. Re-running an old tag checks out its old scripts/configuration. Existing downloads are not changed by a new release.

For a local build, use `APPLE_SIGNING_IDENTITY=- pnpm tauri build --target aarch64-apple-darwin --bundles dmg`. `pnpm tauri dev` does not require release signing credentials. See [Tauri's signing guide](https://v2.tauri.app/distribute/sign/macos/) for ad-hoc signing details.

### Linux (AppImage / `.deb`)

Make the AppImage executable (`chmod +x`) before running it. Install the `.deb` with the distribution package manager. The desktop entry and binary are **Via**.
