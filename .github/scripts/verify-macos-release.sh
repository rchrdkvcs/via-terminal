#!/usr/bin/env bash
set -euo pipefail

# Check the app inside the actual installer, before publishing that installer.
shopt -s nullglob
installers=(src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*.dmg)
if [[ ${#installers[@]} -ne 1 ]]; then
  echo "Expected exactly one macOS DMG, found ${#installers[@]}." >&2
  exit 1
fi

mount_dir="$(mktemp -d)"
cleanup() {
  hdiutil detach "$mount_dir" -quiet || true
  rmdir "$mount_dir" || true
}
trap cleanup EXIT
hdiutil attach "${installers[0]}" -readonly -nobrowse -mountpoint "$mount_dir" -quiet

app="$mount_dir/Via.app"
if [[ ! -d "$app" ]]; then
  echo "The installer does not contain Via.app." >&2
  exit 1
fi
codesign --verify --deep --strict --verbose=2 "$app"
# This release uses an ad-hoc signature without Apple notarization.
# Gatekeeper approval is performed manually by the user after download.
