use crate::error::{AppError, AppResult};
use russh_sftp::{client::error::Error, protocol::StatusCode};
pub fn sftp_error(error: Error) -> AppError {
    let message = match error {
        Error::Status(status) => match status.status_code {
            StatusCode::PermissionDenied => "Accès refusé par le compte distant",
            StatusCode::NoSuchFile => "Fichier ou dossier distant introuvable",
            StatusCode::OpUnsupported => "Opération non prise en charge par le serveur SFTP",
            _ => "L’opération SFTP a échoué",
        },
        Error::Timeout => "Le serveur SFTP ne répond pas",
        _ => "La connexion SFTP a été interrompue",
    };
    AppError::new("file_io", message)
}
pub fn eof(error: &Error) -> bool {
    matches!(error, Error::Status(s) if s.status_code == StatusCode::Eof)
}
pub fn missing(error: &Error) -> bool {
    matches!(error, Error::Status(s) if s.status_code == StatusCode::NoSuchFile)
}
pub fn join(directory: &str, name: &str) -> String {
    format!("{}/{}", directory.trim_end_matches('/'), name)
}
pub fn valid_name(name: &str) -> AppResult<()> {
    if name.is_empty() || name == "." || name == ".." || name.contains(['/', '\\', '\0']) {
        Err(AppError::invalid("Nom de fichier invalide"))
    } else {
        Ok(())
    }
}

impl super::Files {
    pub(super) fn check_owner(&self, owner: &str) -> AppResult<()> {
        if owner != self.owner {
            return Err(AppError::new("file_owner_changed", "Le serveur ou le compte a changé. Ce document ou transfert appartient à la connexion précédente"));
        }
        Ok(())
    }
}
