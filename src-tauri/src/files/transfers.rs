use super::{
    jobs::Job,
    model::{Direction, TransferEvent, TransferPlan, TransferState},
    Files,
};
use crate::error::{AppError, AppResult};
use std::sync::Arc;
impl Files {
    pub fn start_transfer(self: &Arc<Self>, plan: TransferPlan) -> AppResult<()> {
        let TransferPlan {
            id,
            direction,
            sources,
            destination,
            completed_sources,
            directories,
            ..
        } = plan;
        if sources.is_empty() || sources.len() > 10000 {
            return Err(AppError::invalid("Sélection de transfert invalide"));
        }
        let job = Arc::new(Job::new(
            TransferEvent {
                session_id: self.session_id,
                id,
                direction,
                state: TransferState::Running,
                path: destination.clone(),
                bytes: 0,
                total: 0,
                message: None,
                skipped: vec![],
                completed_sources,
                directories,
            },
            self.sink.clone(),
        ));
        let mut jobs = self.jobs.0.lock().unwrap();
        if jobs.contains_key(&id) {
            return Err(AppError::invalid("Ce transfert existe déjà"));
        }
        jobs.insert(id, job.clone());
        drop(jobs);
        let files = self.clone();
        tokio::spawn(async move {
            job.emit(TransferState::Running, None);
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
                Ok(()) => job.emit(TransferState::Completed, None),
                Err(error) if error.code == "file_cancelled" => {
                    job.emit(TransferState::Cancelled, Some(error.message))
                }
                Err(error) => job.emit(TransferState::Failed, Some(error.message)),
            }
            files.jobs.0.lock().unwrap().remove(&id);
        });
        Ok(())
    }
}
