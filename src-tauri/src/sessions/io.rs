use crate::error::{AppError, AppResult};

/// What the hub drives, whether the session is a local shell or an SSH channel.
pub trait SessionIo: Send + Sync {
    fn write(&self, data: &[u8]) -> AppResult<()>;
    fn resize(&self, size: Size) -> AppResult<()>;

    fn close(&self);

    fn files(&self, _call: crate::files::Call) -> AppResult<()> {
        Err(AppError::new(
            "sftp_unavailable",
            "Cet onglet ne propose pas SFTP",
        ))
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
pub struct Size {
    pub cols: u16,
    pub rows: u16,
}

impl Size {
    pub fn validated(self) -> AppResult<Self> {
        if (1..=1000).contains(&self.cols) && (1..=1000).contains(&self.rows) {
            Ok(self)
        } else {
            Err(AppError::invalid("taille de terminal invalide"))
        }
    }
}
