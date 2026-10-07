use super::model::Entry;
use super::{eof, join, sftp_error, valid_name, Files};
use crate::error::{AppError, AppResult};

pub const TEXT_LIMIT: usize = 5_000_000;
pub const CHUNK: u32 = 32 * 1024;
impl Files {
    pub async fn resolve(&self, path: &str) -> AppResult<String> {
        self.raw
            .realpath(path)
            .await
            .map_err(sftp_error)?
            .files
            .into_iter()
            .next()
            .map(|f| f.filename)
            .ok_or_else(|| AppError::invalid("Chemin distant introuvable"))
    }
    pub async fn list(&self, path: &str) -> AppResult<Vec<Entry>> {
        let handle = self.raw.opendir(path).await.map_err(sftp_error)?.handle;
        let result = async {
            let mut entries = Vec::new();
            loop {
                match self.raw.readdir(&handle).await {
                    Ok(names) => {
                        for name in names.files {
                            if name.filename == "." || name.filename == ".." {
                                continue;
                            }
                            valid_name(&name.filename)?;
                            let attrs = name.attrs;
                            let kind = if attrs.is_dir() {
                                "directory"
                            } else if attrs.is_symlink() {
                                "link"
                            } else if attrs.is_regular() {
                                "file"
                            } else {
                                "other"
                            };
                            let target_kind = if kind == "link" {
                                self.raw
                                    .stat(join(path, &name.filename))
                                    .await
                                    .ok()
                                    .map(|s| {
                                        if s.attrs.is_dir() {
                                            "directory"
                                        } else {
                                            "file"
                                        }
                                    })
                            } else {
                                None
                            };
                            entries.push(Entry {
                                target_kind,
                                path: join(path, &name.filename),
                                name: name.filename,
                                kind,
                                size: attrs.size.unwrap_or(0),
                                modified: attrs.mtime,
                                permissions: attrs.permissions,
                            });
                            if entries.len() > 100_000 {
                                return Err(AppError::invalid(
                                    "Ce dossier contient trop d’entrées",
                                ));
                            }
                        }
                    }
                    Err(error) if eof(&error) => break,
                    Err(error) => return Err(sftp_error(error)),
                }
            }
            entries.sort_by(|a, b| {
                (a.kind != "directory", a.name.to_lowercase())
                    .cmp(&(b.kind != "directory", b.name.to_lowercase()))
            });
            Ok(entries)
        }
        .await;
        let closed = self.raw.close(handle).await.map_err(sftp_error);
        result.and_then(|entries| closed.map(|_| entries))
    }
}
