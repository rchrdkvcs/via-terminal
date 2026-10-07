use super::{jobs::Job, model::Collision, sftp_error, valid_name, Files};
use crate::error::{AppError, AppResult};
use std::path::PathBuf;
pub(super) fn local(error: std::io::Error) -> AppError {
    AppError::new(
        "file_local",
        format!("Écriture locale impossible : {error}"),
    )
}
impl Files {
    pub async fn download(
        &self,
        job: &Job,
        sources: Vec<String>,
        destination: String,
    ) -> AppResult<()> {
        let destination = tokio::fs::canonicalize(destination).await.map_err(local)?;
        let mut stack = Vec::new();
        for source in sources {
            let name = source.rsplit('/').next().unwrap_or("");
            local_name(name)?;
            stack.push((source.clone(), destination.join(name)));
        }
        while let Some((source, mut target)) = stack.pop() {
            job.check()?;
            if job.already_completed(&source) {
                continue;
            }
            let attrs = self.raw.lstat(&source).await.map_err(sftp_error)?.attrs;
            if attrs.is_symlink() {
                job.skip(&source);
                continue;
            }
            let remembered = job.directory(&source);
            if let Some(previous) = &remembered {
                let candidate = PathBuf::from(previous);
                if !candidate.starts_with(&destination)
                    || candidate
                        .components()
                        .any(|c| matches!(c, std::path::Component::ParentDir))
                {
                    return Err(AppError::invalid("Destination de reprise invalide"));
                }
                target = candidate;
            }
            let existing = match tokio::fs::symlink_metadata(&target).await {
                Ok(m) => Some(m),
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => None,
                Err(e) => return Err(local(e)),
            };
            if attrs.is_dir() {
                if existing.is_some()
                    && !(remembered.is_some()
                        && existing
                            .as_ref()
                            .is_some_and(|m| m.is_dir() && !m.is_symlink()))
                {
                    match job.collision(&target.to_string_lossy()).await? {
                        Collision::Skip => {
                            job.skip(&source);
                            continue;
                        }
                        Collision::Replace => {
                            if !existing
                                .as_ref()
                                .is_some_and(|m| m.is_dir() && !m.is_symlink())
                            {
                                return Err(AppError::new("file_collision", "Le remplacement d’un fichier ou lien par un dossier est refusé. Choisissez Ignorer ou Conserver les deux"));
                            }
                        }
                        Collision::KeepBoth => target = available_local(&target).await?,
                    }
                }
                tokio::fs::create_dir_all(&target).await.map_err(local)?;
                job.remember_directory(&source, &target.to_string_lossy());
                for entry in self.list(&source).await? {
                    local_name(&entry.name)?;
                    stack.push((entry.path, target.join(entry.name)));
                }
            } else if attrs.is_regular() {
                let mut replace = false;
                if existing.is_some() {
                    match job.collision(&target.to_string_lossy()).await? {
                        Collision::Skip => {
                            job.skip(&source);
                            continue;
                        }
                        Collision::Replace => {
                            replace = true;
                        }
                        Collision::KeepBoth => {
                            target = available_local(&target).await?;
                        }
                    }
                }
                self.download_file(job, &source, target, attrs.size.unwrap_or(0), replace)
                    .await?;
                job.completed(&source);
            } else {
                job.skip(&source);
            }
        }
        Ok(())
    }
}
async fn available_local(path: &std::path::Path) -> AppResult<PathBuf> {
    for index in 1..10000 {
        let candidate = path.with_file_name(format!(
            "{} ({index})",
            path.file_name().unwrap().to_string_lossy()
        ));
        match tokio::fs::symlink_metadata(&candidate).await {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(candidate),
            Err(e) => return Err(local(e)),
            Ok(_) => {}
        }
    }
    Err(AppError::new(
        "file_collision",
        "Aucun nom de destination disponible",
    ))
}

fn local_name(name: &str) -> AppResult<()> {
    valid_name(name)?;
    #[cfg(windows)]
    {
        let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
        if name.contains([':', '*', '?', '"', '<', '>', '|'])
            || name.ends_with(['.', ' '])
            || ["CON", "PRN", "AUX", "NUL"].contains(&stem.as_str())
            || (stem.len() == 4
                && (stem.starts_with("COM") || stem.starts_with("LPT"))
                && matches!(stem.as_bytes()[3], b'1'..=b'9'))
        {
            return Err(AppError::invalid(
                "Ce nom distant n’est pas un nom de fichier Windows valide",
            ));
        }
    }
    Ok(())
}
