use crate::error::AppError;
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
pub fn kind_collision(file_over_directory: bool) -> AppError {
    AppError::new(
        "file_collision",
        if file_over_directory {
            "Un fichier ne peut pas remplacer un dossier. Choisissez Ignorer ou Conserver les deux"
        } else {
            "Un dossier ne peut pas remplacer un fichier ou un lien. Choisissez Ignorer ou Conserver les deux"
        },
    )
}
