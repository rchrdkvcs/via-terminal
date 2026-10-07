//! Publishing one local file: written to a private temporary file beside the destination,
//! given its final mode, then renamed. Replacement keeps the destination's permission bits
//! (without setuid, setgid or sticky); a new file keeps the local bits without group or
//! other write.
use super::{
    browsing::CHUNK, errors::kind_collision, jobs::Job, join, missing, model::Collision,
    sftp_error, upload::local, Files,
};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::{FileAttributes, OpenFlags};
use std::{fs::Metadata, path::PathBuf};
use tokio::io::AsyncReadExt;
use uuid::Uuid;
impl Files {
    /// Uploads one file after resolving a collision; returns `false` when skipped.
    pub(super) async fn upload_entry(
        &self,
        job: &Job,
        source: PathBuf,
        mut target: String,
        metadata: &Metadata,
    ) -> AppResult<bool> {
        let existing = match self.raw.lstat(&target).await {
            Ok(found) => Some(found.attrs),
            Err(e) if missing(&e) => None,
            Err(e) => return Err(sftp_error(e)),
        };
        let mut mode = new_file_mode(metadata);
        let mut replace = false;
        if let Some(existing) = existing {
            match job.collision(&target).await? {
                Collision::Skip => {
                    job.skip(&target);
                    return Ok(false);
                }
                Collision::Replace if existing.is_dir() => return Err(kind_collision(true)),
                Collision::Replace => {
                    replace = true;
                    if !existing.is_symlink() {
                        mode = existing.permissions.map_or(mode, |bits| bits & 0o777);
                    }
                }
                Collision::KeepBoth => target = self.available_remote(&target).await?,
            }
        }
        self.upload_file(job, source, &target, metadata.len(), replace, mode)
            .await?;
        Ok(true)
    }
    async fn upload_file(
        &self,
        job: &Job,
        source: PathBuf,
        target: &str,
        size: u64,
        replace: bool,
        mode: u32,
    ) -> AppResult<()> {
        if replace && !self.replace_supported {
            return Err(AppError::new(
                "file_unsafe_save",
                "Ce serveur ne permet pas de remplacer sûrement le fichier existant",
            ));
        }
        let parent = target.rsplit_once('/').map(|v| v.0).unwrap_or(".");
        let temporary = join(parent, &format!(".via-{}.tmp", Uuid::new_v4()));
        let private = FileAttributes {
            permissions: Some(0o600),
            ..Default::default()
        };
        let flags = OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::EXCLUDE;
        let handle = self
            .raw
            .open(&temporary, flags, private)
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
            let attrs = FileAttributes {
                permissions: Some(mode),
                ..Default::default()
            };
            self.raw
                .setstat(&temporary, attrs)
                .await
                .map_err(sftp_error)?;
            job.check()?;
            if replace {
                self.replace(&temporary, target).await
            } else {
                self.raw
                    .rename(&temporary, target)
                    .await
                    .map(drop)
                    .map_err(sftp_error)
            }
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
fn new_file_mode(metadata: &Metadata) -> u32 {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o755
    }
    #[cfg(not(unix))]
    {
        let _ = metadata;
        0o644
    }
}
