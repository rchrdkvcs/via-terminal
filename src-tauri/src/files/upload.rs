use super::{jobs::Job, join, missing, model::Collision, sftp_error, valid_name, Files};
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
            valid_name(name)?;
            stack.push((source.clone(), join(&destination, name)));
        }
        while let Some((source, mut target)) = stack.pop() {
            job.check()?;
            if job.already_completed(&source.to_string_lossy()) {
                continue;
            }
            let metadata = tokio::fs::symlink_metadata(&source).await.map_err(local)?;
            if metadata.is_symlink() {
                job.skip(&source.to_string_lossy());
                continue;
            }
            if metadata.is_dir() {
                let source_key = source.to_string_lossy();
                let remembered = job.directory(&source_key);
                if let Some(previous) = &remembered {
                    target = previous.clone();
                }
                match self.raw.lstat(&target).await {
                    Ok(attrs) => match if remembered.is_some() && attrs.attrs.is_dir() {
                        Collision::Replace
                    } else {
                        job.collision(&target).await?
                    } {
                        Collision::Skip => {
                            job.skip(&target);
                            continue;
                        }
                        Collision::Replace => {
                            if !attrs.attrs.is_dir() {
                                return Err(AppError::new("file_collision", "Le remplacement d’un fichier ou lien par un dossier est refusé. Choisissez Ignorer ou Conserver les deux"));
                            }
                        }
                        Collision::KeepBoth => {
                            target = self.available_remote(&target).await?;
                            self.raw
                                .mkdir(&target, Default::default())
                                .await
                                .map_err(sftp_error)?;
                        }
                    },
                    Err(error) if missing(&error) => {
                        self.raw
                            .mkdir(&target, Default::default())
                            .await
                            .map_err(sftp_error)?;
                    }
                    Err(error) => return Err(sftp_error(error)),
                }
                job.remember_directory(&source_key, &target);
                let mut entries = tokio::fs::read_dir(source).await.map_err(local)?;
                while let Some(entry) = entries.next_entry().await.map_err(local)? {
                    let name = entry
                        .file_name()
                        .to_str()
                        .ok_or_else(|| AppError::invalid("Nom local non UTF-8"))?
                        .to_owned();
                    valid_name(&name)?;
                    stack.push((entry.path(), join(&target, &name)));
                }
            } else if metadata.is_file() {
                let exists = match self.raw.lstat(&target).await {
                    Ok(_) => true,
                    Err(e) if missing(&e) => false,
                    Err(e) => return Err(sftp_error(e)),
                };
                let mut replace = false;
                if exists {
                    match job.collision(&target).await? {
                        Collision::Skip => {
                            job.skip(&target);
                            continue;
                        }
                        Collision::Replace => {
                            replace = true;
                        }
                        Collision::KeepBoth => {
                            target = self.available_remote(&target).await?;
                        }
                    }
                }
                self.upload_file(job, source.clone(), &target, metadata.len(), replace)
                    .await?;
                job.completed(&source.to_string_lossy());
            } else {
                job.skip(&source.to_string_lossy());
            }
        }
        Ok(())
    }
    async fn available_remote(&self, path: &str) -> AppResult<String> {
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
