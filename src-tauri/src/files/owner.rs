use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

/// Endpoint and account behind a remote explorer; documents and transfers keep the one that
/// produced them. The interface only compares it for equality.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[cfg_attr(test, derive(Default))]
#[serde(transparent)]
pub struct Owner(String);

impl Owner {
    pub fn new(address: &str, port: u16, username: &str) -> Self {
        // A JSON tuple keeps the parts unambiguous whatever characters they contain.
        Self(serde_json::to_string(&(address, port, username)).unwrap_or_default())
    }
}

#[cfg(test)]
impl From<&str> for Owner {
    fn from(value: &str) -> Self {
        Self(value.into())
    }
}

impl super::Files {
    pub(super) fn check_owner(&self, owner: &Owner) -> AppResult<()> {
        if *owner != self.owner {
            return Err(AppError::new(
                "file_owner_changed",
                "Le serveur ou le compte a changé. Ce document ou transfert appartient à la connexion précédente",
            ));
        }
        Ok(())
    }
}
