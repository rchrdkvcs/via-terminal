# Beta release checklist

## Build readiness

- [ ] Version and release notes are updated; the provisional product-name warning is reviewed.
- [ ] CI passes on the release commit with a locked dependency graph.
- [ ] Frontend build/tests/lint and Rust fmt/tests/clippy pass without warnings.
- [ ] Windows installer and, if supported without divergent storage, portable bundle build cleanly.
- [ ] Binaries and updater artifacts are signed; signing secrets appear in neither logs nor artifacts.
- [ ] SBOM/checksums are generated and attached.

## Acceptance

- [ ] Every scenario in [ACCEPTANCE.md](ACCEPTANCE.md) is recorded against the release candidate.
- [ ] Fresh install, upgrade from the previous beta, failed-update recovery, uninstall, and retained-data behavior are verified.
- [ ] Database migration is tested from every supported prior schema and backed up before mutation.
- [ ] Performance results and the reference machine are recorded.
- [ ] Known limitations include Windows-only validation, interactive SSH passwords, no process survival after exit, and features outside V1.

## Security and privacy

- [ ] Dependency/advisory scan has no unexplained critical or high findings.
- [ ] Tauri capabilities and CSP are least-privilege.
- [ ] Synthetic secrets are absent from SQLite, logs, crash recovery, diagnostics, and exports.
- [ ] Unknown SSH fingerprints are never accepted automatically.
- [ ] Private vulnerability reporting is enabled and the repository URL in issue templates is valid.

## Publication and rollback

- [ ] Tag matches the manifest versions and signed updater manifest.
- [ ] Release notes link to upgrade notes, privacy behavior, and known issues.
- [ ] Downloaded artifacts are installed and launched on a clean Windows machine.
- [ ] Updater rollout starts with a beta channel and can be halted by removing the manifest.
- [ ] Previous signed installer remains available for rollback; incompatible schema changes have a documented recovery path.
