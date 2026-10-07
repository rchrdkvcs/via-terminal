use super::{
    errors::kind_collision, jobs::Job, join, missing, model::Collision, paths::remote_name,
    sftp_error, Files,
};
use crate::error::{AppError, AppResult};
use std::path::PathBuf;
pub(super) fn local(error: std::io::Error) -> AppError {
    AppError::new(
        "file_local",
        format!("Lecture du fichier local impossible : {error}"),
    )
}
impl Files {
    pub async fn upload(
        &self,
        job: &Job,
        sources: Vec<String>,
        destination: String,
    ) -> AppResult<()> {
        let mut stack = Vec::new();
        for source in sources {
            let source = PathBuf::from(source);
            let name = source
                .file_name()
                .and_then(|n| n.to_str())
                .ok_or_else(|| AppError::invalid("Nom local invalide"))?;
            remote_name(name)?;
            stack.push((source.clone(), join(&destination, name)));
        }
        while let Some((source, target)) = stack.pop() {
            job.check()?;
            let key = source.to_string_lossy().into_owned();
            if job.already_completed(&key) {
                continue;
            }
            let metadata = tokio::fs::symlink_metadata(&source).await.map_err(local)?;
            if metadata.is_dir() {
                let Some(target) = self.upload_directory(job, &key, target).await? else {
                    continue;
                };
                let mut entries = tokio::fs::read_dir(source).await.map_err(local)?;
                while let Some(entry) = entries.next_entry().await.map_err(local)? {
                    let name = entry
                        .file_name()
                        .to_str()
                        .ok_or_else(|| AppError::invalid("Nom local non UTF-8"))?
                        .to_owned();
                    remote_name(&name)?;
                    stack.push((entry.path(), join(&target, &name)));
                }
            } else if metadata.is_file() {
                if self.upload_entry(job, source, target, &metadata).await? {
                    job.completed(&key);
                }
            } else {
                // Links and special files are never followed.
                job.skip(&key);
            }
        }
        Ok(())
    }
    /// Returns the remote directory receiving the children, or `None` when skipped.
    async fn upload_directory(
        &self,
        job: &Job,
        key: &str,
        mut target: String,
    ) -> AppResult<Option<String>> {
        let remembered = job.directory(key);
        if let Some(previous) = &remembered {
            target = previous.clone();
        }
        match self.raw.lstat(&target).await {
            Ok(existing) if remembered.is_some() && existing.attrs.is_dir() => {}
            Ok(existing) => match job.collision(&target).await? {
                Collision::Skip => {
                    job.skip(&target);
                    return Ok(None);
                }
                Collision::Replace if !existing.attrs.is_dir() => {
                    return Err(kind_collision(false));
                }
                Collision::Replace => {}
                Collision::KeepBoth => {
                    target = self.available_remote(&target).await?;
                    self.make_directory(&target).await?;
                }
            },
            Err(error) if missing(&error) => self.make_directory(&target).await?,
            Err(error) => return Err(sftp_error(error)),
        }
        job.remember_directory(key, &target);
        Ok(Some(target))
    }
    async fn make_directory(&self, path: &str) -> AppResult<()> {
        self.raw
            .mkdir(path, Default::default())
            .await
            .map(drop)
            .map_err(sftp_error)
    }
    pub(super) async fn available_remote(&self, path: &str) -> AppResult<String> {
        for index in 1..10000 {
            let candidate = format!("{path} ({index})");
            match self.raw.lstat(&candidate).await {
                Err(e) if missing(&e) => return Ok(candidate),
                Err(e) => return Err(sftp_error(e)),
                Ok(_) => {}
            }
        }
        Err(AppError::new(
            "file_collision",
            "Aucun nom de destination disponible",
        ))
    }
}
