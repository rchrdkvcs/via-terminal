# Looping session status animations

The persistent failure/disconnection scenes now repeat a short gesture every 3.6
seconds, with a quiet hold between gestures. Packets, the refused key, sparks and
success ripples reset while invisible. Error nodes and the refusal flash return
to their neutral pose/colour before the next cycle. The refusal flash shares the
key's timing. The success badge keeps its one-time checkmark drawing, then stays
readable. Reduced motion disables the scene animations and keeps static badges.

Browser verification uses the real Vue components and synthetic scene names;
no connection, host, credentials or terminal data are involved. See
[the captured active phase](active-phase.png).

To reproduce with `pnpm dev`, open
`http://localhost:1420/.ai/evidence/status-loops/preview.html`, then evaluate:

```js
await import('/.ai/evidence/status-loops/verify.js').then((m) => m.verifyLoops())
```

The browser checks passed for 16 animated elements, including local startup
failure: infinite iterations, invisible or matching endpoints, identical poses
at matching times in successive cycles. Activating the actual reduced-motion
CSS rules yielded zero active CSS animations, with the checkmark drawn and the
badge visible. The browser transport cannot emulate the OS preference directly,
so this check activates the media rules through CSSOM and restores them afterwards.

Validation: 371 frontend tests, 4 release tests, lint, formatting and production
build (including Vue/TypeScript checks) pass. Native Rust code is unchanged.
