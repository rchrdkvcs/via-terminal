use crate::sessions::{
    events::{Event, EventSink, SessionState},
    prompts::Prompt,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use uuid::Uuid;

pub struct TauriSink(pub AppHandle);

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Output {
    session_id: Uuid,
    data_base64: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct StateChanged {
    session_id: Uuid,
    state: SessionState,
    message: Option<String>,
    exit_code: Option<i32>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct PromptPayload {
    session_id: Uuid,
    prompt_id: Uuid,
    prompt: Option<Prompt>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct VaultChanged {
    session_id: Uuid,
    host_id: Option<Uuid>,
}

impl EventSink for TauriSink {
    fn emit(&self, event: Event) {
        let _ = match event {
            Event::Files(progress) => self.0.emit("file-transfer", progress),
            Event::Output { session_id, data } => self.0.emit(
                "terminal-output",
                Output {
                    session_id,
                    data_base64: BASE64.encode(data),
                },
            ),
            Event::State {
                session_id,
                state,
                message,
                exit_code,
            } => self.0.emit(
                "session-state",
                StateChanged {
                    session_id,
                    state,
                    message,
                    exit_code,
                },
            ),
            Event::Prompt {
                session_id,
                prompt_id,
                prompt,
            } => self.0.emit(
                "session-prompt",
                PromptPayload {
                    session_id,
                    prompt_id,
                    prompt: Some(prompt),
                },
            ),
            Event::PromptClosed {
                session_id,
                prompt_id,
            } => self.0.emit(
                "session-prompt",
                PromptPayload {
                    session_id,
                    prompt_id,
                    prompt: None,
                },
            ),
            Event::VaultChanged {
                session_id,
                host_id,
            } => self.0.emit(
                "vault-changed",
                VaultChanged {
                    session_id,
                    host_id,
                },
            ),
        };
    }
}
