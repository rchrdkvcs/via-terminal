use super::model::{Collision, TransferEvent, TransferState};
use crate::{
    error::{AppError, AppResult},
    sessions::events::{Event, EventSink},
};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicU8, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tokio::sync::oneshot;
use uuid::Uuid;
#[derive(Default)]
pub struct Jobs(pub(super) Mutex<HashMap<Uuid, Arc<Job>>>);
pub struct Job {
    pub(super) stopped: AtomicU8,
    pub(super) decision: Mutex<Option<oneshot::Sender<(Collision, bool)>>>,
    pub(super) policy: Mutex<Option<Collision>>,
    pub(super) event: Mutex<TransferEvent>,
    pub(super) last_progress: Mutex<Instant>,
    pub(super) sink: Arc<dyn EventSink>,
}
impl Jobs {
    pub fn cancel(&self, id: Uuid) {
        if let Some(job) = self.0.lock().unwrap().get(&id) {
            job.stopped.store(1, Ordering::Release);
            job.decision.lock().unwrap().take();
        }
    }
    pub fn cancel_all(&self) {
        let ids: Vec<_> = self.0.lock().unwrap().keys().copied().collect();
        for id in ids {
            self.cancel(id);
        }
    }
    pub fn interrupt_all(&self) {
        for job in self.0.lock().unwrap().values() {
            job.stopped.store(2, Ordering::Release);
            job.decision.lock().unwrap().take();
        }
    }
    pub fn is_empty(&self) -> bool {
        self.0.lock().unwrap().is_empty()
    }
    pub fn resolve(&self, id: Uuid, choice: Collision, all: bool) -> AppResult<()> {
        let job = self
            .0
            .lock()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| AppError::not_found("Transfert"))?;
        let reply = job
            .decision
            .lock()
            .unwrap()
            .take()
            .ok_or_else(|| AppError::invalid("Ce transfert n’attend pas de choix"))?;
        reply
            .send((choice, all))
            .map_err(|_| AppError::invalid("Ce transfert est terminé"))
    }
}
impl Job {
    pub fn check(&self) -> AppResult<()> {
        match self.stopped.load(Ordering::Acquire) {
            1 => Err(AppError::new("file_cancelled", "Transfert annulé")),
            2 => Err(AppError::new(
                "file_interrupted",
                "Connexion interrompue. Vous pouvez réessayer après reconnexion",
            )),
            _ => Ok(()),
        }
    }
    pub fn emit(&self, state: TransferState, message: Option<String>) {
        let mut event = self.event.lock().unwrap();
        event.state = state;
        event.message = message;
        self.sink.emit(Event::Files(event.clone()));
    }
    pub fn file(&self, path: &str, total: u64) {
        let mut event = self.event.lock().unwrap();
        event.path = path.into();
        event.bytes = 0;
        event.total = total;
        drop(event);
        self.emit(TransferState::Running, None);
    }
    pub fn progress(&self, bytes: u64) {
        let mut event = self.event.lock().unwrap();
        event.bytes = bytes;
        let mut last = self.last_progress.lock().unwrap();
        if last.elapsed() >= Duration::from_millis(100) || bytes >= event.total {
            *last = Instant::now();
            self.sink.emit(Event::Files(event.clone()));
        }
    }
    pub async fn collision(&self, path: &str) -> AppResult<Collision> {
        self.check()?;
        if let Some(choice) = *self.policy.lock().unwrap() {
            return Ok(choice);
        }
        let (tx, mut rx) = oneshot::channel();
        *self.decision.lock().unwrap() = Some(tx);
        self.event.lock().unwrap().path = path.into();
        self.emit(TransferState::Conflict, None);
        let (choice, all) = loop {
            tokio::select! {
                reply = &mut rx => { self.check()?; break reply.map_err(|_| AppError::new("file_cancelled", "Transfert annulé"))?; },
                _ = tokio::time::sleep(Duration::from_millis(100)) => self.check()?,
            }
        };
        if all {
            *self.policy.lock().unwrap() = Some(choice);
        }
        self.emit(TransferState::Running, None);
        Ok(choice)
    }
}
