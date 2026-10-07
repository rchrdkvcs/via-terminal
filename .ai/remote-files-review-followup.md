# Remote explorer — review corrections (2026-10-07)

Review baseline: `9bc8e24`, including the working tree and new files. Original feature baseline: `f3b0c3e`. Implementation and UI audit were delegated to separate Claude Opus 5.5 agents at medium effort. Independent Standards and Spec reviews then inspected the integrated changes, followed by separate verification rounds.

## Standards

The final independent reviewer reported **0 documented rule violations**, **1 P3 design judgment**, and **0 hypotheses**. The remaining judgment concerned direct writes to explorer visibility in the title bar and command actions. Parent integration added `files.setVisible` and routed both callers through it; typecheck, lint and scoped tests passed afterward.

Earlier observations were addressed: store-owned transfer plans and staging lifecycle; typed wire replies; shared transfer-state and dirty-document predicates; store actions for document/error/view changes; extracted modules; RemoteOwner terminology; document tab navigation, exact Delete handling and prevention of focus on the hidden close icon. The workbench watcher observes primitive sources, preserving explorer focus during directory updates. Destructive foreground contrast is 4.65:1 in light mode and 6.16:1 in dark mode, with the dark confirmation verified in the preview.

No confirmed Standards finding remains after parent verification. This does not assert native assistive-technology acceptance.

## Spec

The final independent reviewer reported **0 P1/P2/P3 findings**, **1 minor judgment**, and **1 hypothesis**. The judgment—retaining an interrupted transfer as failed after a late completion—is intentional: the UI retains the observed interruption, offers retry and incorporates cleanup warnings. The specification now states this behavior.

The hypothesis concerned retry when all sources were already completed. A public native-service regression exercises both upload and download with absent, already-completed sources: retry completes, preserves the progress list, transfers zero bytes and creates no duplicate files.

Confirmed fixes include transactional draft abandonment, lazy SFTP opening without blocking shell output, POSIX backslash names, upload permission handling, cancellable drop preparation, explicit staging cleanup, owner-aware saving, directory refresh independent of document reads, and retention of late native cleanup warnings. Web drop provides no original Unix mode; executable-bit preservation is explicitly limited to picker uploads, with a visible drop hint and remote chmod available.

No confirmed Spec finding remains. Native picker/OS drop, real app quit gestures, Windows/Linux, screen-reader speech and real network fault injection remain manual acceptance gates.

## Validation

220 frontend tests, 67 Rust tests and four release-script tests. Production build, typecheck, lint, formatting and Clippy pass. Browser captures and contrast evidence: [UI audit](remote-files-ui-audit.md). Temporary preview servers were stopped.
