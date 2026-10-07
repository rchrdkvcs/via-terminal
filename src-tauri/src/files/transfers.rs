use super::{
    jobs::Job,
    model::{Direction, TransferEvent},
    Files,
};
use crate::error::{AppError, AppResult};
use std::sync::{atomic::AtomicU8, Arc, Mutex};
use std::time::Instant;
use uuid::Uuid;
impl Files {
    pub fn start_transfer(
        self: &Arc<Self>,
        id: Uuid,
        direction: Direction,
        sources: Vec<String>,
        destination: String,
        completed_sources: Vec<String>,
        directories: std::collections::HashMap<String, String>,
    ) -> AppResult<()> {
        if sources.is_empty() || sources.len() > 10000 {
            return Err(AppError::invalid("Sélection de transfert invalide"));
        }
        let job = Arc::new(Job {
            stopped: AtomicU8::new(0),
            decision: Mutex::new(None),
            policy: Mutex::new(None),
            last_progress: Mutex::new(Instant::now()),
            event: Mutex::new(TransferEvent {
                session_id: self.session_id,
                id,
                state: "running",
                path: destination.clone(),
                bytes: 0,
                total: 0,
                message: None,
                skipped: vec![],
                completed_sources,
                directories,
            }),
            sink: self.sink.clone(),
        });
        let mut jobs = self.jobs.0.lock().unwrap();
        if jobs.contains_key(&id) {
            return Err(AppError::invalid("Ce transfert existe déjà"));
        }
        jobs.insert(id, job.clone());
        drop(jobs);
        let files = self.clone();
        tokio::spawn(async move {
            job.emit("running", None);
            let result = match direction {
                Direction::Upload => files.upload(&job, sources, destination).await,
                Direction::Download => files.download(&job, sources, destination).await,
            };
            let result = result.map_err(|error| {
                if let Err(mut stopped) = job.check() {
                    stopped.message = format!("{} ; {}", stopped.message, error.message);
                    stopped
                } else {
                    error
                }
            });
            match result {
                Ok(()) => job.emit("completed", None),
                Err(error) => job.emit(
                    if error.code == "file_cancelled" {
                        "cancelled"
                    } else {
                        "failed"
                    },
                    Some(error.message),
                ),
            }
            files.jobs.0.lock().unwrap().remove(&id);
        });
        Ok(())
    }
}
