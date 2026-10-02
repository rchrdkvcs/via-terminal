//! Live sessions behind tabs: local shells and SSH channels.
//!
//! [`SessionHub`] is the only interface the commands use. Both kinds of
//! session satisfy [`SessionIo`]; output, state changes and prompts leave
//! through the [`EventSink`]. A session removes itself from the hub when it
//! ends, so a closed id simply stops accepting input.

pub mod events;
pub mod integration;
mod local;
pub mod prompts;
pub mod shells;
pub mod ssh;

use crate::error::{AppError, AppResult};
use events::EventSink;
use prompts::{PromptAnswer, Prompts};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};
use uuid::Uuid;

pub use local::LocalSpec;

pub trait SessionIo: Send + Sync {
    fn write(&self, data: &[u8]) -> AppResult<()>;
    fn resize(&self, size: Size) -> AppResult<()>;
    /// Ask the session to end. Its state event follows asynchronously.
    fn close(&self);
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
pub struct Size {
    pub cols: u16,
    pub rows: u16,
}

impl Size {
    pub fn validated(self) -> AppResult<Self> {
        if (1..=1000).contains(&self.cols) && (1..=1000).contains(&self.rows) {
            Ok(self)
        } else {
            Err(AppError::invalid("taille de terminal invalide"))
        }
    }
}

type Registry = Arc<Mutex<HashMap<Uuid, Arc<dyn SessionIo>>>>;

/// Lets a session take itself out of the registry when it ends.
#[derive(Clone)]
pub struct Ending {
    registry: Registry,
    prompts: Arc<Prompts>,
    id: Uuid,
}

impl Ending {
    pub fn ended(&self) {
        self.registry.lock().unwrap().remove(&self.id);
        self.prompts.withdraw(self.id);
    }
}

pub struct SessionHub {
    registry: Registry,
    sink: Arc<dyn EventSink>,
    prompts: Arc<Prompts>,
}

impl SessionHub {
    pub fn new(sink: Arc<dyn EventSink>) -> Self {
        Self {
            registry: Registry::default(),
            prompts: Arc::new(Prompts::new(sink.clone())),
            sink,
        }
    }

    pub fn open_local(&self, spec: LocalSpec, size: Size) -> AppResult<Uuid> {
        let size = size.validated()?;
        let id = Uuid::new_v4();
        let session = local::spawn(id, spec, size, self.sink.clone(), self.ending(id))?;
        self.registry.lock().unwrap().insert(id, session);
        Ok(id)
    }

    /// Returns at once; progress arrives as state events and prompts.
    pub fn open_ssh(
        &self,
        plan: ssh::ConnectPlan,
        store: Arc<dyn ssh::ConnectionStore>,
        size: Size,
    ) -> AppResult<Uuid> {
        let size = size.validated()?;
        let id = Uuid::new_v4();
        let context = ssh::Context {
            id,
            sink: self.sink.clone(),
            prompts: self.prompts.clone(),
            store,
            ending: self.ending(id),
        };
        let session = ssh::spawn(plan, size, context);
        self.registry.lock().unwrap().insert(id, session);
        Ok(id)
    }

    pub fn write(&self, id: Uuid, data: &[u8]) -> AppResult<()> {
        self.get(id)?.write(data)
    }

    pub fn resize(&self, id: Uuid, size: Size) -> AppResult<()> {
        self.get(id)?.resize(size.validated()?)
    }

    pub fn close(&self, id: Uuid) {
        let session = self.registry.lock().unwrap().remove(&id);
        self.prompts.withdraw(id);
        if let Some(session) = session {
            session.close();
        }
    }

    pub fn close_all(&self) {
        let ids: Vec<Uuid> = self.registry.lock().unwrap().keys().copied().collect();
        ids.into_iter().for_each(|id| self.close(id));
    }

    pub fn answer(&self, prompt_id: Uuid, answer: PromptAnswer) -> AppResult<()> {
        self.prompts.answer(prompt_id, answer)
    }

    fn get(&self, id: Uuid) -> AppResult<Arc<dyn SessionIo>> {
        self.registry
            .lock()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| AppError::new("session_closed", "cette session est terminée"))
    }

    fn ending(&self, id: Uuid) -> Ending {
        Ending {
            registry: self.registry.clone(),
            prompts: self.prompts.clone(),
            id,
        }
    }
}
