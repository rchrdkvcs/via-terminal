# Remote explorer opening and row padding

PR #54 removed the explorer's double-click handler, leaving Enter as the only
opening gesture. Restoring the row handler opens files, directories and directory
links from any cell. Single-click and keyboard selection retain their behavior.
The name header and entry button now use 8 px horizontal padding, matching the
right edge of the selected and hovered row backgrounds.

Verification uses sanitized data from `.ai/remote-files-fixture.js`. A temporary
Playwright harness drove the rendered FilePanel and verified directory and link
navigation, creation of a document tab, and equal 8 px left/right row insets with
the existing 32 px row height. The harness was removed after verification.

- `docked-dark.png`: selected `.profile` and hovered `archive.tar.gz`, 1280×800.
- `docked-light.png`: the same selection and hover in light appearance.
- `narrow-light.png`: the docked explorer at 640×500, with metadata hidden.

The FileList regression tests failed for all three entry kinds before the fix
and pass afterward. Format, lint, 367 frontend tests, 4 release tests and the
production build pass. No Rust, IPC, persistence or credential handling changed;
native SSH/SFTP and platform WebViews were not exercised.
