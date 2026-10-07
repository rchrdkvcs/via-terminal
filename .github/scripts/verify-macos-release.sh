#!/usr/bin/env bash
set -euo pipefail
shopt -s nullglob
installers=(src-tauri/target/aarch64-apple-darwin/release/bundle/dmg/*.dmg)
if [[ ${#installers[@]} -ne 1 ]]; then
  echo "Expected exactly one macOS DMG, found ${#installers[@]}." >&2
  exit 1
fi

mount_dir="$(mktemp -d)"
archive_dir="$(mktemp -d)"
cleanup() {
  hdiutil detach "$mount_dir" -quiet || true
  rmdir "$mount_dir" || true
  rm -rf "$archive_dir"
}
trap cleanup EXIT
hdiutil attach "${installers[0]}" -readonly -nobrowse -mountpoint "$mount_dir" -quiet

app="$mount_dir/Via.app"
if [[ ! -d "$app" ]]; then
  echo "The installer does not contain Via.app." >&2
  exit 1
fi
codesign --verify --deep --strict --verbose=2 "$app"

archives=(src-tauri/target/aarch64-apple-darwin/release/bundle/macos/*.app.tar.gz)
if [[ ${#archives[@]} -ne 1 || ! -s "${archives[0]}.sig" ]]; then
  echo "Expected one macOS updater archive with its signature." >&2
  exit 1
fi
tar -xzf "${archives[0]}" -C "$archive_dir"
codesign --verify --deep --strict --verbose=2 "$archive_dir/Via.app"
