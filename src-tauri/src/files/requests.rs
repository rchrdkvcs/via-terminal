use super::{model::Request, sftp_error, Files};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::FileAttributes;
use serde_json::{json, Value};
use std::sync::Arc;
impl Files {
    pub async fn execute(self: &Arc<Self>, request: Request) -> AppResult<Value> {
        match request {
            Request::List { path } => {
                let path = self.resolve(&path).await?;
                Ok(json!({"entries": self.list(&path).await?, "path": path, "owner": self.owner}))
            }
            Request::Read { path } => Ok(json!(self.read_document(&path).await?)),
            Request::Save {
                document,
                original,
                overwrite,
            } => Ok(json!(
                self.save_document(document, &original, overwrite).await?
            )),
            Request::Create { path, directory } => {
                self.create(&path, directory).await?;
                Ok(Value::Null)
            }
            Request::Move { path, destination } => {
                self.raw
                    .rename(path, destination)
                    .await
                    .map_err(sftp_error)?;
                Ok(Value::Null)
            }
            Request::Delete { path } => {
                self.delete(&path).await?;
                Ok(Value::Null)
            }
            Request::Chmod { path, permissions } => {
                if permissions > 0o7777 {
                    return Err(AppError::invalid("Permissions Unix invalides"));
                }
                self.raw
                    .setstat(
                        path,
                        FileAttributes {
                            permissions: Some(permissions),
                            ..Default::default()
                        },
                    )
                    .await
                    .map_err(sftp_error)?;
                Ok(Value::Null)
            }
            Request::Transfer {
                id,
                direction,
                sources,
                destination,
                completed_sources,
                directories,
                owner,
            } => {
                self.check_owner(&owner)?;
                self.start_transfer(
                    id,
                    direction,
                    sources,
                    destination,
                    completed_sources,
                    directories,
                )?;
                Ok(Value::Null)
            }
            Request::Cancel { id } => {
                self.jobs.cancel(id);
                Ok(Value::Null)
            }
            Request::Resolve { id, choice, all } => {
                self.jobs.resolve(id, choice, all)?;
                Ok(Value::Null)
            }
        }
    }
}
