# Lessons

## Do not call a feature verified until the real gesture was driven

**2026-08-29 — sidebar drag and drop.** The first attempt reported `pnpm build`,
`pnpm lint`, `pnpm test` and `cargo test` as proof. All of them passed while the
feature did nothing at all in the window, because none of them touches the
browser drag machinery.

Rules for myself:

- A unit test around a store function proves the arithmetic, never the gesture.
  When the change is an interaction, drive the interaction.
- In this repository, drive it with CDP against the running window:
  `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333 pnpm tauri dev`,
  then `node .ai/dnd-repro.mjs`.
- Dispatch real `Input.dispatchMouseEvent` presses and moves. Synthetic
  `DragEvent`s built in the page pass even when the platform layer eats the
  drag, so they cannot tell a working feature from a broken one.
- Say plainly which checks were skipped instead of listing the ones that ran.

## Tauri eats HTML drag and drop unless it is told not to

`dragDropEnabled` defaults to `true` and installs a native drop target on the
webview, which swallows every `dragover` and `drop` before the page sees them.
Set `"dragDropEnabled": false` in `tauri.conf.json`, and `.drag_and_drop(false)`
on every `WebviewWindowBuilder`, because windows built in Rust do not inherit
the value from the configuration file.

## Accept a drop on `dragenter`, not only on `dragover`

A pointer that arrives on a target and releases at once fires `dragenter` and
then `dragend`, with no `dragover` in between. A handler that only calls
`preventDefault()` on `dragover` refuses that drop, and the row silently springs
back. Bind both events to the same handler.

## Positions are named by their neighbour, never by an index

`move_sidebar_node` and `favorite_move` insert into the sibling list with the
moved row already removed. Callers that also subtracted one for a downward move
corrected the same shift twice. The visible rows also hide favourites and
collapsed folders, so a screen index is not a stored position. Pass the id of
the row to land before, and let the store resolve it against the records.

## Vite reloads the page when a script under `.ai` is saved

That resets the window mid-run and makes a check fail for the wrong reason.
`server.watch.ignored` now covers `.ai`.

## Read the state before blaming persistence

**2026-10-02 — redesign smoke check.** A smoke run "lost" a pinned split after
reload. The store and the backend agreed all along: typing « powershell » in
the command bar had switched to the existing PowerShell tab instead of opening
a new one, so the next Ctrl+Shift+D unpinned the existing split. Print the
store (`window.__via` in dev) and the backend (`app_bootstrap`) after every
step before suspecting the save path.

## The app restarts whenever a Rust file changes

`pnpm tauri dev` rebuilds and relaunches on any edit under `src-tauri`, which
drops the CDP connection and every temporary tab. Do not drive the window
while someone else is editing Rust.

## No raw control characters through the shell on Windows

Git Bash rewrites `\r` and `\` in `node -e` strings and heredocs, which
planted a literal carriage return in a source file. Write scripts to a file
with the editor tools, and build control characters with
`String.fromCharCode` in code that is evaluated over CDP.

## Real SSH checks

`sessions/ssh/tests.rs` runs the client against an in-process russh server.
For the interface, a throwaway `ssh2` server in Node on 127.0.0.1:2222 is
enough to see the host key, password and shell panes.

## A swipe lock that waits for silence never lifts on a touchpad

**2026-10-07 — space swipe.** "Works once, then nothing until a click" was not
Blink latching the wheel target on a removed node: in headless Chromium a
latched target that leaves the DOM is dropped and the next event goes to the
node under the pointer. The cause was `spaceSwipe.ts` locking a gesture until
160 ms without events. Touchpad inertia trails on for about a second, and the
next swipe lands while it still runs, so the events never pause and the lock
holds; the click only helped because it made the user stop. `node
.ai/space-swipe-repro.mjs` showed it: `FAIL swipe while the last one's inertia
still runs 2/4: switches [], expected ["a"]`, while every swipe with a pause
before it passed.

- Read the end of a touchpad gesture from the deltas (inertia shrinks
  steadily, fresh fingers jump back up or turn around), not from silence alone.
- CDP `Input.dispatchMouseEvent` wheels carry no phases and never latch;
  `Input.synthesizeScrollGesture` with `gestureSourceType: 'mouse'` does. Use
  the second when a check depends on latching.

## Read touchpad swipes from the OS, not from wheel rhythm

**2026-10-07 — space swipe, again.** Guessing fingers from inertia in wheel
deltas kept failing in new ways. macOS scroll events carry the phases
(`phase`, `momentumPhase`) that web wheel events drop, so `swipe.rs` watches
them with an `NSEvent` local monitor, claims horizontal gestures that start
over the sidebar region the interface reports, swallows them and their
momentum, and forwards `trackpad-swipe` phases. `swipeTracker.ts` is a port of
Firefox's `SwipeTracker`, the code behind Zen's space swipes. The wheel
heuristics only remain as a fallback where the OS gives no phases.
