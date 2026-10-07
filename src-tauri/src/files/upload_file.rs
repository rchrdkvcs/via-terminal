use super::join;
use super::{browsing::CHUNK, jobs::Job, sftp_error, upload::local, Files};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::{FileAttributes, OpenFlags};
use std::path::PathBuf;
use tokio::io::AsyncReadExt;
use uuid::Uuid;
impl Files {
    pub(super) async fn upload_file(
        &self,
        job: &Job,
        source: PathBuf,
        target: &str,
        size: u64,
        replace: bool,
    ) -> AppResult<()> {
        if replace && !self.replace_supported {
            return Err(AppError::new(
                "file_unsafe_save",
                "Ce serveur ne permet pas de remplacer sûrement le fichier existant",
            ));
        }
        let parent = target.rsplit_once('/').map(|v| v.0).unwrap_or(".");
        let temporary = join(parent, &format!(".via-{}.tmp", Uuid::new_v4()));
        let handle = self
            .raw
            .open(
                &temporary,
                OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::EXCLUDE,
                FileAttributes {
                    permissions: Some(0o600),
                    ..Default::default()
                },
            )
            .await
            .map_err(sftp_error)?
            .handle;
        job.file(target, size);
        let result: AppResult<()> = async {
            let mut file = tokio::fs::File::open(source).await.map_err(local)?;
            let mut buffer = vec![0; CHUNK as usize];
            let mut offset = 0;
            loop {
                job.check()?;
                let len = file.read(&mut buffer).await.map_err(local)?;
                if len == 0 {
                    break;
                }
                self.raw
                    .write(&handle, offset, buffer[..len].to_vec())
                    .await
                    .map_err(sftp_error)?;
                offset += len as u64;
                job.progress(offset);
            }
            self.raw.close(&handle).await.map_err(sftp_error)?;
            job.check()?;
            if replace {
                self.replace(&temporary, target).await?;
            } else {
                self.raw
                    .rename(&temporary, target)
                    .await
                    .map_err(sftp_error)?;
            }
            Ok(())
        }
        .await;
        if let Err(error) = result {
            let _ = self.raw.close(handle).await;
            if self.raw.remove(&temporary).await.is_err() {
                return Err(AppError::new(
                    error.code,
                    format!(
                        "{} ; fichier temporaire restant possible : {}",
                        error.message, temporary
                    ),
                ));
            }
            return Err(error);
        }
        Ok(())
    }
}
