pub mod events;
pub mod integration;
mod io;
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

pub use io::{SessionIo, Size};
pub use local::LocalSpec;

type Registry = Arc<Mutex<HashMap<Uuid, Arc<dyn SessionIo>>>>;

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

    pub fn open_ssh(
        &self,
        plan: ssh::ConnectPlan,
        store: Arc<dyn ssh::ConnectionStore>,
        size: Option<Size>,
    ) -> AppResult<Uuid> {
        let size = size.map(Size::validated).transpose()?;
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

    pub async fn files(
        &self,
        id: Uuid,
        request: crate::files::model::Request,
    ) -> AppResult<crate::files::model::Reply> {
        let (reply, receive) = tokio::sync::oneshot::channel();
        self.get(id)?.files(crate::files::Call { request, reply })?;
        receive
            .await
            .map_err(|_| AppError::new("session_closed", "La session SFTP est terminée"))?
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
