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
