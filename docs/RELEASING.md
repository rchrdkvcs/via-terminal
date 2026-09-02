# Release checklist

A git tag `vX.Y.Z` triggers GitHub Actions. Quality and compile run on Windows, macOS, and Linux. The release workflow builds installers and attaches them to a **draft** GitHub Release. A human reviews the draft, then publishes it. There is no in-app updater in this slice: do not produce or require an updater manifest or updater signing keys.

The workflow already requests `contents: write`. If asset upload fails with “Resource not accessible by integration”, set the repository Actions permission to allow GitHub Actions to create and update releases.

## Version and tag

- [ ] Bump the same version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
- [ ] Push tag `vX.Y.Z` matching that version.

## Build readiness

- [ ] Version and release notes are updated; the provisional product-name warning is reviewed.
- [ ] CI quality and compile jobs pass on Windows, macOS, and Linux with a locked dependency graph.
- [ ] Frontend build/tests/lint and Rust fmt/tests/clippy pass without warnings.
- [ ] The draft GitHub Release includes:
  - Windows x64: NSIS `.exe` and MSI
  - macOS arm64 (Apple Silicon): DMG
  - Linux x64: AppImage and `.deb`
- [ ] Binaries are unsigned. macOS uses Tauri's ad-hoc identity `-`. Windows SmartScreen and macOS Gatekeeper warnings are expected; see Operator notes.
- [ ] No updater manifest, updater endpoint, or updater signing key is required or published.

## Acceptance

- [ ] Every scenario in [ACCEPTANCE.md](ACCEPTANCE.md) is recorded against the release candidate on Windows, macOS, and Linux.
- [ ] Fresh install, upgrade by reinstalling over the previous version, uninstall, and retained-data behavior are verified on each OS as available.
- [ ] Database migration is tested from every supported prior schema and backed up before mutation.
- [ ] Performance results and the reference machine are recorded (OS, CPU, RAM, WebView, build hash).
- [ ] Known limitations include unsigned binaries (SmartScreen / Gatekeeper), interactive SSH passwords, no process survival after exit, no in-app updater, and features outside V1.

## Security and privacy

- [ ] Dependency/advisory scan has no unexplained critical or high findings.
- [ ] Tauri capabilities and CSP are least-privilege.
- [ ] Synthetic secrets are absent from SQLite, logs, crash recovery, diagnostics, and exports.
- [ ] Unknown SSH fingerprints are never accepted automatically.
- [ ] Private vulnerability reporting is enabled and the repository URL in issue templates is valid.

## Publication and rollback

- [ ] Tag `vX.Y.Z` matches the three version files above.
- [ ] Release notes link to upgrade notes, privacy behavior, and known issues, including unsigned-binary install steps.
- [ ] Downloaded artifacts are installed and launched on a clean machine for each target OS.
- [ ] A human reviews the draft GitHub Release, then publishes it. Collaborators download installers from that Release; the repository may remain private.
- [ ] Previous installers remain on older GitHub Releases for rollback; incompatible schema changes have a documented recovery path.

## Operator notes

Installers are not code-signed. The running app does not check for updates; install a newer version by downloading it from the GitHub Release in a browser.

### Windows (unsigned NSIS `.exe` / MSI)

SmartScreen may warn that the publisher is unknown. Choose **More info**, then **Run anyway**. If the file is blocked after download, open **Properties**, check **Unblock**, and apply.

### macOS (ad-hoc signed arm64 DMG)

The DMG is ad-hoc signed with identity `-` and is not notarized. Gatekeeper blocks unidentified developers. After mounting the DMG, Control-click (or right-click) the app, choose **Open**, and confirm. If macOS still refuses, open **System Settings → Privacy & Security** and allow the app.

### Linux (AppImage / `.deb`)

Make the AppImage executable (`chmod +x`) before running it. Install the `.deb` with the distribution package manager.
