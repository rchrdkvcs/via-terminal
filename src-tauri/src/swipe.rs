//! Touchpad swipes between spaces, read from the OS the way browsers do.
//!
//! Web wheel events carry no touchpad phases, so the interface cannot tell
//! fingers from inertia. On macOS the scroll events do: this module watches
//! them before the webview, picks out horizontal gestures that start over the
//! sidebar, and forwards their phases as `trackpad-swipe` events. Those
//! gestures and their momentum are swallowed, so the webview never scrolls
//! with them; every other scroll goes through untouched. The interface sets
//! where the sidebar is with `swipe_region`; elsewhere this is a no-op and the
//! interface falls back to wheel events.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;

/// The sidebar in window coordinates (CSS px, from the top left), or `None`
/// while there is no other space to swipe to.
#[derive(Clone, Copy, Debug, Deserialize)]
pub struct Region {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Region {
    fn contains(&self, x: f64, y: f64) -> bool {
        x >= self.x && x < self.x + self.width && y >= self.y && y < self.y + self.height
    }
}

static REGION: Mutex<Option<Region>> = Mutex::new(None);

#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Phase {
    Start,
    Update,
    End,
    Cancel,
}

/// One step of a swipe. Deltas follow web wheel events: positive `dx` is the
/// fingers moving left with natural scrolling, whatever the user's setting.
#[derive(Clone, Copy, Debug, PartialEq, Serialize)]
pub struct Pan {
    pub phase: Phase,
    pub dx: f64,
    pub dy: f64,
    /// Event time in ms, on the system's uptime clock.
    pub t: f64,
}

/// A scroll event, reduced to what decides whether it is a swipe.
#[derive(Clone, Copy, Debug, Default)]
pub struct Scroll {
    pub precise: bool,
    pub phase: GesturePhase,
    pub momentum: GesturePhase,
    pub dx: f64,
    pub dy: f64,
    pub x: f64,
    pub y: f64,
    pub t: f64,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum GesturePhase {
    #[default]
    None,
    MayBegin,
    Began,
    Changed,
    Ended,
    Cancelled,
}

/// What to do with a scroll event.
#[derive(Debug, PartialEq)]
pub enum Verdict {
    Pass,
    Swallow(Option<Pan>),
}

/// Follows scroll gestures and claims the ones that are swipes. Like Gecko's
/// swipe tracker, a gesture is a swipe when its first movement is at least
/// eight times more horizontal than vertical.
#[derive(Default)]
pub struct Tracker {
    /// The current gesture is still to be judged on its first movement.
    undecided: bool,
    swiping: bool,
    /// The momentum after a swipe belongs to it.
    coasting: bool,
}

impl Tracker {
    pub fn feed(&mut self, scroll: Scroll, region: Option<Region>) -> Verdict {
        if !scroll.precise {
            return Verdict::Pass;
        }
        let pan = |phase| Pan {
            phase,
            dx: scroll.dx,
            dy: scroll.dy,
            t: scroll.t,
        };
        match scroll.phase {
            // Fingers landing, or a new gesture: the last one and its momentum are over.
            GesturePhase::MayBegin => {
                self.undecided = true;
                self.swiping = false;
                self.coasting = false;
                Verdict::Pass
            }
            GesturePhase::Began if !self.swiping => {
                self.undecided = true;
                self.coasting = false;
                self.judge(scroll, region, pan(Phase::Start))
            }
            GesturePhase::Began | GesturePhase::Changed => {
                if self.swiping {
                    Verdict::Swallow(Some(pan(Phase::Update)))
                } else {
                    self.judge(scroll, region, pan(Phase::Start))
                }
            }
            GesturePhase::Ended | GesturePhase::Cancelled => {
                self.undecided = false;
                if !self.swiping {
                    return Verdict::Pass;
                }
                self.swiping = false;
                self.coasting = true;
                let phase = if scroll.phase == GesturePhase::Ended {
                    Phase::End
                } else {
                    Phase::Cancel
                };
                Verdict::Swallow(Some(pan(phase)))
            }
            GesturePhase::None if self.coasting && scroll.momentum != GesturePhase::None => {
                if matches!(
                    scroll.momentum,
                    GesturePhase::Ended | GesturePhase::Cancelled
                ) {
                    self.coasting = false;
                }
                Verdict::Swallow(None)
            }
            GesturePhase::None => {
                self.coasting = false;
                Verdict::Pass
            }
        }
    }

    fn judge(&mut self, scroll: Scroll, region: Option<Region>, start: Pan) -> Verdict {
        if !self.undecided || (scroll.dx == 0.0 && scroll.dy == 0.0) {
            return Verdict::Pass;
        }
        self.undecided = false;
        let over = region.is_some_and(|r| r.contains(scroll.x, scroll.y));
        if over && scroll.dx.abs() > scroll.dy.abs() * 8.0 {
            self.swiping = true;
            Verdict::Swallow(Some(start))
        } else {
            Verdict::Pass
        }
    }
}

#[tauri::command]
pub fn swipe_region(region: Option<Region>) {
    *REGION.lock().unwrap_or_else(|e| e.into_inner()) = region;
}

/// The bump of a Force Touch trackpad as a swipe crosses its threshold.
#[tauri::command]
pub fn swipe_haptic() {
    #[cfg(target_os = "macos")]
    mac::haptic();
}

/// Starts watching scroll events for the main window. Call on the main thread.
#[allow(unused_variables)]
pub fn install(app: &tauri::AppHandle) {
    #[cfg(target_os = "macos")]
    mac::install(app);
}

#[cfg(target_os = "macos")]
mod mac {
    use super::*;
    use block2::RcBlock;
    use objc2::MainThreadMarker;
    use objc2_app_kit::{
        NSEvent, NSEventMask, NSEventPhase, NSHapticFeedbackManager, NSHapticFeedbackPattern,
        NSHapticFeedbackPerformanceTime, NSHapticFeedbackPerformer,
    };
    use std::cell::RefCell;
    use std::ptr::NonNull;
    use tauri::{Emitter, Manager};

    fn phase(p: NSEventPhase) -> GesturePhase {
        if p.contains(NSEventPhase::MayBegin) {
            GesturePhase::MayBegin
        } else if p.contains(NSEventPhase::Began) {
            GesturePhase::Began
        } else if p.contains(NSEventPhase::Ended) {
            GesturePhase::Ended
        } else if p.contains(NSEventPhase::Cancelled) {
            GesturePhase::Cancelled
        } else if p.contains(NSEventPhase::Changed) || p.contains(NSEventPhase::Stationary) {
            GesturePhase::Changed
        } else {
            GesturePhase::None
        }
    }

    pub fn install(app: &tauri::AppHandle) {
        let Some(mtm) = MainThreadMarker::new() else {
            return;
        };
        let Some(window) = app.get_webview_window("main") else {
            return;
        };
        let Ok(main) = window.ns_window() else { return };
        let main = main as usize;
        let app = app.clone();
        let tracker = RefCell::new(Tracker::default());

        let handler = RcBlock::new(move |event: NonNull<NSEvent>| -> *mut NSEvent {
            // SAFETY: AppKit hands the monitor a live event.
            let ev = unsafe { event.as_ref() };
            let Some(window) = ev.window(mtm) else {
                return event.as_ptr();
            };
            if objc2::rc::Retained::as_ptr(&window) as usize != main {
                return event.as_ptr();
            }
            let height = window
                .contentView()
                .map_or(0.0, |view| view.frame().size.height);
            let at = ev.locationInWindow();
            // Content follows the fingers whether or not natural scrolling is on.
            let sign = if ev.isDirectionInvertedFromDevice() {
                -1.0
            } else {
                1.0
            };
            let scroll = Scroll {
                precise: ev.hasPreciseScrollingDeltas(),
                phase: phase(ev.phase()),
                momentum: phase(ev.momentumPhase()),
                dx: sign * ev.scrollingDeltaX(),
                dy: sign * ev.scrollingDeltaY(),
                x: at.x,
                y: height - at.y,
                t: ev.timestamp() * 1000.0,
            };
            let region = *REGION.lock().unwrap_or_else(|e| e.into_inner());
            match tracker.borrow_mut().feed(scroll, region) {
                Verdict::Pass => event.as_ptr(),
                Verdict::Swallow(pan) => {
                    if let Some(pan) = pan {
                        let _ = app.emit_to("main", "trackpad-swipe", pan);
                    }
                    std::ptr::null_mut()
                }
            }
        });
        // SAFETY: called on the main thread; the monitor lives as long as the app.
        let monitor = unsafe {
            NSEvent::addLocalMonitorForEventsMatchingMask_handler(
                NSEventMask::ScrollWheel,
                &handler,
            )
        };
        std::mem::forget(monitor);
    }

    pub fn haptic() {
        NSHapticFeedbackManager::defaultPerformer().performFeedbackPattern_performanceTime(
            NSHapticFeedbackPattern::Alignment,
            NSHapticFeedbackPerformanceTime::Now,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use GesturePhase as G;

    const SIDEBAR: Region = Region {
        x: 0.0,
        y: 0.0,
        width: 260.0,
        height: 800.0,
    };

    fn scroll(phase: GesturePhase, dx: f64, dy: f64) -> Scroll {
        Scroll {
            precise: true,
            phase,
            dx,
            dy,
            x: 100.0,
            y: 300.0,
            ..Default::default()
        }
    }

    fn momentum(phase: GesturePhase, dx: f64) -> Scroll {
        Scroll {
            momentum: phase,
            ..scroll(G::None, dx, 0.0)
        }
    }

    fn phases(tracker: &mut Tracker, events: &[Scroll]) -> Vec<Option<Phase>> {
        events
            .iter()
            .map(|e| match tracker.feed(*e, Some(SIDEBAR)) {
                Verdict::Pass => None,
                Verdict::Swallow(pan) => pan.map(|p| p.phase),
            })
            .collect()
    }

    #[test]
    fn claims_a_horizontal_swipe_and_its_momentum() {
        let mut t = Tracker::default();
        let got = phases(
            &mut t,
            &[
                scroll(G::MayBegin, 0.0, 0.0),
                scroll(G::Began, 9.0, 1.0),
                scroll(G::Changed, 12.0, 3.0),
                scroll(G::Ended, 0.0, 0.0),
                momentum(G::Began, 8.0),
                momentum(G::Changed, 4.0),
                momentum(G::Ended, 0.0),
                scroll(G::Began, 0.0, 6.0),
            ],
        );
        assert_eq!(
            got,
            [
                None,
                Some(Phase::Start),
                Some(Phase::Update),
                Some(Phase::End),
                None,
                None,
                None,
                None
            ]
        );
        // The momentum was swallowed, the vertical scroll after it was not.
        assert_eq!(
            t.feed(momentum(G::Changed, 3.0), Some(SIDEBAR)),
            Verdict::Pass
        );
    }

    #[test]
    fn leaves_vertical_and_diagonal_scrolls_alone() {
        let mut t = Tracker::default();
        let got = phases(
            &mut t,
            &[scroll(G::Began, 4.0, 2.0), scroll(G::Changed, 30.0, 0.0)],
        );
        assert_eq!(got, [None, None]);
    }

    #[test]
    fn leaves_swipes_outside_the_sidebar_alone() {
        let mut t = Tracker::default();
        let outside = Scroll {
            x: 600.0,
            ..scroll(G::Began, 10.0, 0.0)
        };
        assert_eq!(t.feed(outside, Some(SIDEBAR)), Verdict::Pass);
        assert_eq!(t.feed(scroll(G::Began, 10.0, 0.0), None), Verdict::Pass);
    }

    #[test]
    fn a_new_swipe_cuts_the_last_one_s_momentum_short() {
        let mut t = Tracker::default();
        let got = phases(
            &mut t,
            &[
                scroll(G::Began, 10.0, 0.0),
                scroll(G::Ended, 0.0, 0.0),
                momentum(G::Began, 8.0),
                scroll(G::MayBegin, 0.0, 0.0),
                scroll(G::Began, -10.0, 0.0),
                scroll(G::Cancelled, 0.0, 0.0),
            ],
        );
        assert_eq!(
            got,
            [
                Some(Phase::Start),
                Some(Phase::End),
                None,
                None,
                Some(Phase::Start),
                Some(Phase::Cancel)
            ]
        );
    }

    #[test]
    fn mouse_wheels_pass_through() {
        let mut t = Tracker::default();
        let wheel = Scroll {
            precise: false,
            ..scroll(G::None, 10.0, 0.0)
        };
        assert_eq!(t.feed(wheel, Some(SIDEBAR)), Verdict::Pass);
    }
}
