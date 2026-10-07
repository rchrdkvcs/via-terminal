mod browsing;
mod documents;
mod download;
mod download_file;
mod job_progress;
mod jobs;
pub mod model;
mod operations;
mod paths;
mod reading;
mod replacement;
mod requests;
mod shutdown;
mod staging;
mod transfers;
mod upload;
mod upload_file;
use crate::{
    error::{AppError, AppResult},
    sessions::events::EventSink,
};
pub use paths::{eof, join, missing, sftp_error, valid_name};
use russh_sftp::client::RawSftpSession;
use serde_json::Value;
pub use staging::Staging;
use std::sync::Arc;
use uuid::Uuid;

pub struct Call {
    pub request: model::Request,
    pub reply: tokio::sync::oneshot::Sender<AppResult<Value>>,
}
pub struct Files {
    pub owner: String,
    pub raw: RawSftpSession,
    pub replace_supported: bool,
    pub session_id: Uuid,
    pub sink: Arc<dyn EventSink>,
    pub jobs: jobs::Jobs,
    pub saving: tokio::sync::Mutex<()>,
}
impl Files {
    pub async fn from_stream<S>(
        stream: S,
        session_id: Uuid,
        sink: Arc<dyn EventSink>,
    ) -> AppResult<Arc<Self>>
    where
        S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
    {
        let raw = RawSftpSession::new(stream);
        let version = raw.init().await.map_err(sftp_error)?;
        if version.version != 3 {
            return Err(AppError::new(
                "sftp_unavailable",
                "Version SFTP non prise en charge",
            ));
        }
        let replace_supported = version
            .extensions
            .get("posix-rename@openssh.com")
            .is_some_and(|v| v == "1");
        Ok(Arc::new(Self {
            owner: String::new(),
            raw,
            replace_supported,
            session_id,
            sink,
            jobs: jobs::Jobs::default(),
            saving: tokio::sync::Mutex::new(()),
        }))
    }
}

#[cfg(test)]
mod collision_tests;
#[cfg(test)]
mod reading_tests;
#[cfg(test)]
pub(crate) mod test_peer;
#[cfg(test)]
mod test_peer_directories;
#[cfg(test)]
mod test_peer_io;
#[cfg(test)]
mod tests;
#[cfg(test)]
mod transfer_tests;

#[cfg(test)]
mod operation_tests;
#[cfg(test)]
mod recursive_tests;
#[cfg(test)]
mod test_peer_setup;

#[cfg(test)]
mod owner_tests;
#[cfg(test)]
mod retry_tests;
