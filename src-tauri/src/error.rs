use serde::Serialize;

/// The error every command returns. `code` is stable and machine readable;
/// `message` is safe to show and never contains a secret.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, thiserror::Error)]
#[serde(rename_all = "camelCase")]
#[error("{code}: {message}")]
pub struct AppError {
    pub code: &'static str,
    pub message: String,
}

pub type AppResult<T> = Result<T, AppError>;

impl AppError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }

    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new("invalid", message)
    }

    pub fn not_found(what: &str) -> Self {
        Self::new("not_found", format!("{what} introuvable"))
    }

    pub fn storage(cause: impl std::fmt::Display) -> Self {
        Self::new("storage", cause.to_string())
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(cause: rusqlite::Error) -> Self {
        Self::storage(cause)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(cause: serde_json::Error) -> Self {
        Self::storage(cause)
    }
}
