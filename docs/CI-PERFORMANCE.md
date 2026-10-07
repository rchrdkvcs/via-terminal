# CI and release build performance

## Measured baseline

The successful [v0.3.2 release run](https://github.com/rchrdkvcs/via-terminal/actions/runs/37588980048) on 2026-10-07 provides the baseline, before these workflow changes:

| Job or step                                             | Duration         |
| ------------------------------------------------------- | ---------------- |
| Release quality (Windows, sequential frontend and Rust) | about 4 min 30 s |
| Windows installer job                                   | 17 min 30 s      |
| Windows build/upload step                               | 13 min           |
| Windows Rust release compilation, within that step      | 11 min 54 s      |
| Windows Rust cache post-step                            | 2 min            |
| Linux installer job                                     | about 11 min     |
| macOS installer job                                     | about 7 min      |

The [most recent ordinary CI run](https://github.com/rchrdkvcs/via-terminal/actions/runs/37603632007) took about 3 min 5 s with its existing Windows quality cache.

Release logs report `No cache found` for Rust on Windows. The cache inventory contains separate `publish` caches for v0.3.1 and v0.3.2, but none on `main`. GitHub allows restoring default-branch caches and prevents reuse across different tags. Quality caches contain debug-profile dependencies, which cannot replace optimized release-profile dependencies. Changing only a cache key would therefore not fix release recompilation.

## Implemented changes

- Frontend checks run on Ubuntu alongside Windows native tests and Clippy. Shared composite actions keep CI and release validation consistent. The CI `quality` job remains a combined required check: it fails if either job fails or is cancelled.
- Native quality jobs omit debugger symbols for development/test profiles through job-scoped Cargo environment variables. Release optimization and debug profiles used by local developers are unchanged. Quality caches are shared between workflows and saved only from `main`.
- Release frontend quality builds `dist` once, after synchronizing the tag version. Each installer job downloads that run's immutable frontend artifact. `.github/tauri-prebuilt.conf.json` suppresses the repeated frontend build only for those installer jobs. Type checking, tests and formatting still run before packaging.
- **Warm release cache** runs on pushes to `main`, independently of CI. On a Rust dependency/toolchain cache miss it invokes the same Tauri release compilation with `--no-bundle`, for Windows, Linux and macOS arm64. It creates no installers, uploads no release assets, and receives no signing secrets. On an exact hit it skips compilation and frontend setup. Letting an in-progress run finish ensures a cold cache can actually be saved even when several commits arrive.
- Release jobs restore the same platform-specific cache with `shared-key: release-<platform>`, but do not save tag-scoped copies. This removes the Windows cache post-step from the publication path and avoids consuming storage with copies inaccessible to future tags.
- Rust checks and release compilations use `--locked` to keep dependency resolution consistent with the checked-in lockfile.

## Operation and trade-offs

After merging, wait for **Warm release cache** on `main` to finish before publishing the first release. It can also be run manually on `main`. That initial preparation costs a cold compilation on each platform; subsequent exact matches skip it. The work is moved ahead of release publication and reused, rather than eliminated. This uses extra runner time on dependency updates in exchange for shorter releases. PRs do not run cache warming.

Caches are an optimization, never an input required for correctness. A release still builds from scratch if warming fails, a cache expires, dependencies change, or stable Rust advances. Keys include the Rust toolchain and Cargo dependency manifests/lockfile. Workspace version bumps are normalized by `rust-cache`; changing the release tag alone does not invalidate dependency reuse. Compiled workspace application artifacts are excluded by the action's default cleanup, so the release still compiles its own tagged application code.

GitHub evicts caches unused for more than seven days and applies repository storage limits. Regular main builds refresh access; a quiet repository may need a manual warm-up shortly before a release. New features or platform/compiler changes can still cause Cargo to rebuild affected dependencies. No measured post-change Windows timing is claimed until the revised workflow has run on GitHub-hosted runners.

## Verify the gain

Compare the next release against the baseline above. In the publish job's Rust cache step, confirm a restored `release-<platform>` cache from `main`. In Tauri output, compare the Cargo `Finished release profile` timing, the installer job's total duration, and the absence of a cache upload post-step. Also verify that **Warm release cache** skips compilation on a subsequent unchanged dependency set.

Do not compare a cold run with a warm run without recording the cache state and Rust version. Preserve the signing checks and complete updater-manifest gate when changing packaging.

Sources: [GitHub cache access restrictions](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache), [rust-cache inputs and cleanup](https://github.com/Swatinem/rust-cache), [Tauri build configuration](https://v2.tauri.app/reference/config/#buildconfig). The installed Tauri CLI's `build --help` documents `--no-bundle`, configuration merging, and Cargo argument forwarding.
