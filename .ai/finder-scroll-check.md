# Finder scroll regression

Start `pnpm dev`, open port 1420 with the collaborative preview, and evaluate
the source of `finder-scroll-check.js` with its `export` keywords removed.
Run `await setup(false); check()` at 640 × 240 for an explorer tab, and
`await setup(true, 12); check()` at 640 × 400 for the docked explorer with transfers.
The fixture replaces file IPC with sanitized replies; run it only in the browser preview.

Before the fix, the tab check returned `pass: false`, `outerScroll: 13`,
`headerShift: -13`, and `listScroll: 500`. Both scroll containers moved independently.
The docked transfer scenario also exposed absolutely positioned screen reader labels
escaping their scroll container and extending the explorer's scrollable content.

The fix lets the file list shrink, removes scrolling from the explorer frame,
contains scroll propagation in each list, and positions hidden labels within
their own scroll containers. The browser check must return zero outer scroll,
zero header shift, and positive inner scroll. Also drive `preview_scroll` on each
list past its bottom and on the navigation header: navigation must remain visible.

This is a browser regression because jsdom does not calculate CSS overflow.
Native platform WebViews are not covered by this check.
