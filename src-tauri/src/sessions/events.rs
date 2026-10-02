//! What sessions tell the interface. The [`EventSink`] seam has a Tauri
//! adapter in the app and a recording adapter in tests.

use super::prompts::Prompt;
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum SessionState {
    /// Local process starting, or SSH resolving and opening the socket.
    Connecting,
    /// SSH: checking the server key.
    Verifying,
    /// SSH: trying credentials.
    Authenticating,
    /// Input and output flow.
    Ready,
    /// The process or remote shell ended on its own.
    Exited,
    /// Could not start or connect.
    Failed,
    /// SSH: the connection dropped while ready.
    Disconnected,
}

#[derive(Debug, Clone)]
pub enum Event {
    Output {
        session_id: Uuid,
        data: Vec<u8>,
    },
    State {
        session_id: Uuid,
        state: SessionState,
        message: Option<String>,
        exit_code: Option<i32>,
    },
    Prompt {
        session_id: Uuid,
        prompt_id: Uuid,
        prompt: Prompt,
    },
    /// A prompt was withdrawn without an answer (session closed, timed out).
    PromptClosed {
        session_id: Uuid,
        prompt_id: Uuid,
    },
    /// The vault changed as a side effect of a session (quick-connect save,
    /// accepted key, remembered password).
    VaultChanged {
        session_id: Uuid,
        host_id: Option<Uuid>,
    },
}

pub trait EventSink: Send + Sync + 'static {
    fn emit(&self, event: Event);
}

impl dyn EventSink {
    pub fn state(&self, session_id: Uuid, state: SessionState, message: Option<String>) {
        self.emit(Event::State {
            session_id,
            state,
            message,
            exit_code: None,
        });
    }
}

#[cfg(test)]
pub mod recording {
    use super::*;
    use std::sync::Mutex;

    #[derive(Default)]
    pub struct Recorder(pub Mutex<Vec<Event>>);

    impl EventSink for Recorder {
        fn emit(&self, event: Event) {
            self.0.lock().unwrap().push(event);
        }
    }

    impl Recorder {
        pub fn states(&self, id: Uuid) -> Vec<SessionState> {
            self.0
                .lock()
                .unwrap()
                .iter()
                .filter_map(|event| match event {
                    Event::State {
                        session_id, state, ..
                    } if *session_id == id => Some(*state),
                    _ => None,
                })
                .collect()
        }
    }
}
