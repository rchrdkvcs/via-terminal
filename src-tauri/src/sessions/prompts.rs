use super::events::{Event, EventSink};
use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use tokio::sync::oneshot;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum Prompt {
    HostKey {
        address: String,
        port: u16,
        algorithm: String,
        fingerprint: String,

        previous_fingerprint: Option<String>,
    },
    Authentication {
        address: String,
        username: Option<String>,
        can_remember: bool,
    },
    Username {
        address: String,
    },
    Password {
        username: String,
        address: String,
        can_remember: bool,

        retry: bool,
    },
    Passphrase {
        key_label: String,
        can_remember: bool,
        retry: bool,
    },
    KeyboardInteractive {
        name: String,
        instructions: String,
        fields: Vec<PromptField>,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PromptField {
    pub label: String,
    pub echo: bool,
}

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum PromptAnswer {
    Credential {
        credential: super::ssh::CredentialChoice,
    },
    Authentication {
        username: String,
        password: String,
        remember: bool,
    },
    Accept,
    Cancel,
    Text {
        value: String,
        remember: bool,
    },
    Fields {
        values: Vec<String>,
    },
}

type Pending = HashMap<Uuid, (Uuid, oneshot::Sender<PromptAnswer>)>;

pub struct Prompts {
    pending: Mutex<Pending>,
    sink: Arc<dyn EventSink>,
}

impl Prompts {
    pub fn new(sink: Arc<dyn EventSink>) -> Self {
        Self {
            pending: Mutex::default(),
            sink,
        }
    }

    pub async fn ask(&self, session_id: Uuid, prompt: Prompt) -> PromptAnswer {
        let prompt_id = Uuid::new_v4();
        let (sender, receiver) = oneshot::channel();
        self.pending
            .lock()
            .unwrap()
            .insert(prompt_id, (session_id, sender));
        self.sink.emit(Event::Prompt {
            session_id,
            prompt_id,
            prompt,
        });
        receiver.await.unwrap_or(PromptAnswer::Cancel)
    }

    pub fn answer(&self, prompt_id: Uuid, answer: PromptAnswer) -> AppResult<()> {
        let (_, sender) = self
            .pending
            .lock()
            .unwrap()
            .remove(&prompt_id)
            .ok_or_else(|| AppError::not_found("question"))?;

        let _ = sender.send(answer);
        Ok(())
    }

    pub fn withdraw(&self, session_id: Uuid) {
        let withdrawn: Vec<Uuid> = {
            let mut pending = self.pending.lock().unwrap();
            let ids: Vec<Uuid> = pending
                .iter()
                .filter(|(_, (owner, _))| *owner == session_id)
                .map(|(id, _)| *id)
                .collect();
            ids.iter().for_each(|id| {
                pending.remove(id);
            });
            ids
        };
        for prompt_id in withdrawn {
            self.sink.emit(Event::PromptClosed {
                session_id,
                prompt_id,
            });
        }
    }
}

#[cfg(test)]
#[path = "prompts_tests.rs"]
mod tests;
