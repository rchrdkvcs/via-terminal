//! Private local copies of files dropped in the interface, kept until their transfer
//! completes, is cancelled or is abandoned. Cleanup is explicit: stale copies at launch,
//! every copy at normal exit. Cleanup failures never prevent Via from starting.
use super::paths::local_name;
use crate::error::{AppError, AppResult};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tokio::io::AsyncWriteExt;
use uuid::Uuid;
const CHUNK_LIMIT: usize = 256 * 1024;
pub struct Staging {
    roots: Mutex<HashMap<Uuid, PathBuf>>,
    base: PathBuf,
}
impl Staging {
    /// Never fails: an unusable directory only makes later drops fail.
    pub fn new(base: PathBuf) -> Self {
        let staging = Self {
            roots: Mutex::new(HashMap::new()),
            base,
        };
        staging.clear();
        staging
    }
    /// Removes every staged copy, best effort, including those left by a previous run.
    pub fn clear(&self) {
        self.roots.lock().unwrap().clear();
        let Ok(entries) = std::fs::read_dir(&self.base) else {
            return;
        };
        for entry in entries.flatten() {
            let staged = entry
                .file_name()
                .to_str()
                .is_some_and(|name| Uuid::parse_str(name).is_ok());
            if staged {
                let _ = std::fs::remove_dir_all(entry.path());
            }
        }
    }
    pub fn begin(&self) -> AppResult<Uuid> {
        self.prepare()?;
        let id = Uuid::new_v4();
        let root = self.base.join(id.to_string());
        std::fs::create_dir(&root).map_err(io)?;
        self.roots.lock().unwrap().insert(id, root);
        Ok(id)
    }
    pub async fn directory(&self, id: Uuid, relative: &str) -> AppResult<()> {
        tokio::fs::create_dir_all(self.path(id, relative)?)
            .await
            .map_err(io)
    }
    pub async fn chunk(&self, id: Uuid, relative: &str, data: &[u8]) -> AppResult<()> {
        if data.len() > CHUNK_LIMIT {
            return Err(AppError::invalid("Bloc de fichier trop volumineux"));
        }
        let path = self.path(id, relative)?;
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await.map_err(io)?;
        }
        let mut file = tokio::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(path)
            .await
            .map_err(io)?;
        file.write_all(data).await.map_err(io)
    }
    pub fn finish(&self, id: Uuid) -> AppResult<Vec<String>> {
        std::fs::read_dir(self.root(id)?)
            .map_err(io)?
            .map(|entry| {
                entry
                    .map(|e| e.path().to_string_lossy().into_owned())
                    .map_err(io)
            })
            .collect()
    }
    pub fn discard(&self, id: Uuid) -> AppResult<()> {
        if let Some(root) = self.roots.lock().unwrap().remove(&id) {
            std::fs::remove_dir_all(root).map_err(io)?;
        }
        Ok(())
    }
    fn prepare(&self) -> AppResult<()> {
        std::fs::create_dir_all(&self.base).map_err(io)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let private = std::fs::Permissions::from_mode(0o700);
            std::fs::set_permissions(&self.base, private).map_err(io)?;
        }
        Ok(())
    }
    fn path(&self, id: Uuid, relative: &str) -> AppResult<PathBuf> {
        for name in relative.split('/') {
            local_name(name)?;
        }
        Ok(self.root(id)?.join(relative))
    }
    fn root(&self, id: Uuid) -> AppResult<PathBuf> {
        self.roots
            .lock()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| AppError::not_found("Dépôt temporaire"))
    }
}
/// Splits a raw chunk request: the path's length (u32, big-endian), the UTF-8 path, then the
/// bytes to append. The path and size are still checked by `Staging::chunk`.
pub fn parse_chunk(body: &[u8]) -> AppResult<(&str, &[u8])> {
    let invalid = || AppError::invalid("Bloc de fichier invalide");
    let (length, rest) = body.split_first_chunk::<4>().ok_or_else(invalid)?;
    let length = usize::try_from(u32::from_be_bytes(*length)).map_err(|_| invalid())?;
    if length > rest.len() {
        return Err(invalid());
    }
    let (path, data) = rest.split_at(length);
    Ok((std::str::from_utf8(path).map_err(|_| invalid())?, data))
}
fn io(error: std::io::Error) -> AppError {
    AppError::new(
        "file_local",
        format!("Préparation locale impossible : {error}"),
    )
}

#[cfg(test)]
#[path = "staging_tests.rs"]
mod tests;
