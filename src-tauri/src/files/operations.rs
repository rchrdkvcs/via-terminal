use super::{join, paths::remote_name, sftp_error, Files};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::OpenFlags;
impl Files {
    pub async fn create(&self, parent: &str, name: &str, directory: bool) -> AppResult<()> {
        remote_name(name)?;
        let path = join(parent, name);
        if directory {
            self.raw
                .mkdir(path, Default::default())
                .await
                .map_err(sftp_error)?;
        } else {
            let flags = OpenFlags::WRITE | OpenFlags::CREATE | OpenFlags::EXCLUDE;
            let file = self
                .raw
                .open(path, flags, Default::default())
                .await
                .map_err(sftp_error)?;
            self.raw.close(file.handle).await.map_err(sftp_error)?;
        }
        Ok(())
    }
    pub async fn delete(&self, path: &str) -> AppResult<()> {
        if path == "/" || path.is_empty() || path == "." || path == ".." {
            return Err(AppError::invalid("Ce dossier ne peut pas être supprimé"));
        }
        let mut stack = vec![(path.to_owned(), false)];
        while let Some((path, visited)) = stack.pop() {
            let attrs = self.raw.lstat(&path).await.map_err(sftp_error)?.attrs;
            if attrs.is_dir() {
                if visited {
                    self.raw.rmdir(path).await.map_err(sftp_error)?;
                } else {
                    let entries = self.list(&path).await?;
                    stack.push((path, true));
                    stack.extend(entries.into_iter().map(|entry| (entry.path, false)));
                }
            } else {
                self.raw.remove(path).await.map_err(sftp_error)?;
            }
        }
        Ok(())
    }
}
