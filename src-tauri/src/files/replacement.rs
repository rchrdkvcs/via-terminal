use super::{sftp_error, Files};
use crate::error::{AppError, AppResult};
use russh_sftp::protocol::{Packet, StatusCode};
impl Files {
    pub async fn replace(&self, source: &str, destination: &str) -> AppResult<()> {
        if !self.replace_supported {
            return Err(AppError::new(
                "file_unsafe_save",
                "Le serveur ne permet pas le remplacement sûr",
            ));
        }
        let mut data = Vec::new();
        for path in [source, destination] {
            data.extend_from_slice(&(path.len() as u32).to_be_bytes());
            data.extend_from_slice(path.as_bytes());
        }
        match self
            .raw
            .extended("posix-rename@openssh.com", data)
            .await
            .map_err(sftp_error)?
        {
            Packet::Status(status) if status.status_code == StatusCode::Ok => Ok(()),
            Packet::Status(status) => {
                Err(sftp_error(russh_sftp::client::error::Error::Status(status)))
            }
            _ => Err(AppError::new(
                "file_io",
                "Réponse de remplacement inattendue",
            )),
        }
    }
}
