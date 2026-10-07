use crate::error::{AppError, AppResult};
use std::{collections::HashMap, path::PathBuf, sync::Mutex};
use tokio::io::AsyncWriteExt;
use uuid::Uuid;
pub struct Staging {
    roots: Mutex<HashMap<Uuid, PathBuf>>,
    base: PathBuf,
}
impl Staging {
    pub fn new(base: PathBuf) -> AppResult<Self> {
        std::fs::create_dir_all(&base).map_err(io)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&base, std::fs::Permissions::from_mode(0o700)).map_err(io)?;
        }
        for entry in std::fs::read_dir(&base).map_err(io)? {
            let entry = entry.map_err(io)?;
            if entry
                .file_name()
                .to_str()
                .is_some_and(|name| Uuid::parse_str(name).is_ok())
            {
                std::fs::remove_dir_all(entry.path()).map_err(io)?;
            }
        }
        Ok(Self {
            roots: Mutex::new(HashMap::new()),
            base,
        })
    }
    pub async fn directory(&self, id: Uuid, relative: &str) -> AppResult<()> {
        tokio::fs::create_dir_all(self.path(id, relative)?)
            .await
            .map_err(io)
    }
    fn path(&self, id: Uuid, relative: &str) -> AppResult<PathBuf> {
        for name in relative.split('/') {
            super::valid_name(name)?;
            if name.contains(':') {
                return Err(AppError::invalid("Nom local invalide"));
            }
        }
        Ok(self.root(id)?.join(relative))
    }
    pub fn begin(&self) -> AppResult<Uuid> {
        let id = Uuid::new_v4();
        let root = self.base.join(id.to_string());
        std::fs::create_dir(&root).map_err(io)?;
        self.roots.lock().unwrap().insert(id, root);
        Ok(id)
    }
    pub async fn chunk(&self, id: Uuid, relative: &str, data: Vec<u8>) -> AppResult<()> {
        if data.len() > 256 * 1024 {
            return Err(AppError::invalid("Bloc de fichier trop volumineux"));
        }
        let path = self.path(id, relative)?;
        tokio::fs::create_dir_all(path.parent().unwrap())
            .await
            .map_err(io)?;
        let mut file = tokio::fs::OpenOptions::new()
            .append(true)
            .create(true)
            .open(path)
            .await
            .map_err(io)?;
        file.write_all(&data).await.map_err(io)
    }
    pub fn finish(&self, id: Uuid) -> AppResult<Vec<String>> {
        let root = self.root(id)?;
        std::fs::read_dir(root)
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
    fn root(&self, id: Uuid) -> AppResult<PathBuf> {
        self.roots
            .lock()
            .unwrap()
            .get(&id)
            .cloned()
            .ok_or_else(|| AppError::not_found("Dépôt temporaire"))
    }
}
impl Drop for Staging {
    fn drop(&mut self) {
        for root in self.roots.get_mut().unwrap().values() {
            let _ = std::fs::remove_dir_all(root);
        }
    }
}
fn io(error: std::io::Error) -> AppError {
    AppError::new(
        "file_local",
        format!("Préparation locale impossible : {error}"),
    )
}
