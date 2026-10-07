use super::{
    model::{Reply, Request},
    sftp_error, Files,
};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::FileAttributes;
use std::sync::Arc;
impl Files {
    pub async fn execute(self: &Arc<Self>, request: Request) -> AppResult<Reply> {
        match request {
            Request::List { path } => Ok(Reply::Listing(self.listing(&path).await?)),
            Request::Read { path } => Ok(Reply::Document(self.read_document(&path).await?)),
            Request::Save {
                document,
                original,
                overwrite,
            } => Ok(Reply::Document(
                self.save_document(document, &original, overwrite).await?,
            )),
            Request::Create {
                parent,
                name,
                directory,
            } => self.create(&parent, &name, directory).await.map(done),
            Request::Move { path, destination } => self
                .raw
                .rename(path, destination)
                .await
                .map_err(sftp_error)
                .map(done),
            Request::Delete { path } => self.delete(&path).await.map(done),
            Request::Chmod { path, permissions } => {
                if permissions > 0o7777 {
                    return Err(AppError::invalid("Permissions Unix invalides"));
                }
                let attrs = FileAttributes {
                    permissions: Some(permissions),
                    ..Default::default()
                };
                self.raw
                    .setstat(path, attrs)
                    .await
                    .map_err(sftp_error)
                    .map(done)
            }
            Request::Transfer(plan) => {
                self.check_owner(&plan.owner)?;
                self.start_transfer(plan).map(done)
            }
            Request::Cancel { id } => {
                self.jobs.cancel(id);
                Ok(Reply::Done)
            }
            Request::Resolve { id, choice, all } => self.jobs.resolve(id, choice, all).map(done),
        }
    }
}
fn done<T>(_: T) -> Reply {
    Reply::Done
}

#[cfg(test)]
impl Files {
    /// Replies as the interface receives them.
    pub(super) async fn json(self: &Arc<Self>, request: Request) -> AppResult<serde_json::Value> {
        Ok(serde_json::to_value(self.execute(request).await?).unwrap())
    }
}
