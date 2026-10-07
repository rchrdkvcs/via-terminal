use super::model::{Entry, EntryKind, Listing};
use super::{eof, join, paths::remote_name, sftp_error, Files};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::FileAttributes;

pub const TEXT_LIMIT: usize = 5_000_000;
pub const CHUNK: u32 = 32 * 1024;
const ENTRY_LIMIT: usize = 100_000;
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
    pub(super) async fn listing(&self, path: &str) -> AppResult<Listing> {
        let path = self.resolve(path).await?;
        Ok(Listing {
            entries: self.list(&path).await?,
            owner: self.owner.clone(),
            path,
        })
    }
    pub async fn list(&self, path: &str) -> AppResult<Vec<Entry>> {
        let handle = self.raw.opendir(path).await.map_err(sftp_error)?.handle;
        let result = async {
            let mut entries = Vec::new();
            loop {
                let names = match self.raw.readdir(&handle).await {
                    Ok(names) => names.files,
                    Err(error) if eof(&error) => break,
                    Err(error) => return Err(sftp_error(error)),
                };
                for name in names {
                    // A server cannot name an entry with a separator; skip rather than escape.
                    if remote_name(&name.filename).is_err() {
                        continue;
                    }
                    let entry_path = join(path, &name.filename);
                    let kind = kind(&name.attrs);
                    let target_kind = match kind {
                        EntryKind::Link => self.raw.stat(&entry_path).await.ok().map(|s| {
                            if s.attrs.is_dir() {
                                EntryKind::Directory
                            } else {
                                EntryKind::File
                            }
                        }),
                        _ => None,
                    };
                    entries.push(Entry {
                        target_kind,
                        path: entry_path,
                        name: name.filename,
                        kind,
                        size: name.attrs.size.unwrap_or(0),
                        modified: name.attrs.mtime,
                        permissions: name.attrs.permissions,
                    });
                    if entries.len() > ENTRY_LIMIT {
                        return Err(AppError::invalid("Ce dossier contient trop d’entrées"));
                    }
                }
            }
            entries.sort_by(|a, b| {
                (a.kind != EntryKind::Directory, a.name.to_lowercase())
                    .cmp(&(b.kind != EntryKind::Directory, b.name.to_lowercase()))
            });
            Ok(entries)
        }
        .await;
        let closed = self.raw.close(handle).await.map_err(sftp_error);
        result.and_then(|entries| closed.map(|_| entries))
    }
}
fn kind(attrs: &FileAttributes) -> EntryKind {
    if attrs.is_dir() {
        EntryKind::Directory
    } else if attrs.is_symlink() {
        EntryKind::Link
    } else if attrs.is_regular() {
        EntryKind::File
    } else {
        EntryKind::Other
    }
}
