use super::eof;
use super::{browsing::CHUNK, download::local, jobs::Job, sftp_error, Files};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::OpenFlags;
use std::path::PathBuf;
use tokio::io::AsyncWriteExt;
use uuid::Uuid;
impl Files {
    pub(super) async fn download_file(
        &self,
        job: &Job,
        source: &str,
        target: PathBuf,
        size: u64,
        replace: bool,
    ) -> AppResult<()> {
        let temporary = target.with_file_name(format!(".via-{}.tmp", Uuid::new_v4()));
        let handle = self
            .raw
            .open(source, OpenFlags::READ, Default::default())
            .await
            .map_err(sftp_error)?
            .handle;
        job.file(source, size);
        let result = async {
            let mut output = tokio::fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&temporary)
                .await
                .map_err(local)?;
            let mut offset = 0;
            loop {
                job.check()?;
                match self.raw.read(&handle, offset, CHUNK).await {
                    Ok(data) => {
                        if data.data.is_empty() {
                            break;
                        }
                        output.write_all(&data.data).await.map_err(local)?;
                        offset += data.data.len() as u64;
                        job.progress(offset);
                    }
                    Err(e) if eof(&e) => break,
                    Err(e) => return Err(sftp_error(e)),
                }
            }
            output.sync_all().await.map_err(local)?;
            drop(output);
            job.check()?;
            if replace {
                tokio::fs::rename(&temporary, &target)
                    .await
                    .map_err(local)?;
            } else {
                // Hard-link publication refuses a raced destination without overwriting it.
                tokio::fs::hard_link(&temporary, &target)
                    .await
                    .map_err(local)?;
                tokio::fs::remove_file(&temporary).await.map_err(local)?;
            }
            Ok(())
        }
        .await;
        let _ = self.raw.close(handle).await;
        if let Err(error) = result {
            if let Err(cleanup) = tokio::fs::remove_file(&temporary).await {
                if cleanup.kind() != std::io::ErrorKind::NotFound {
                    return Err(AppError::new(
                        error.code,
                        format!(
                            "{} ; fichier temporaire restant : {}",
                            error.message,
                            temporary.display()
                        ),
                    ));
                }
            }
            return Err(error);
        }
        Ok(())
    }
}
