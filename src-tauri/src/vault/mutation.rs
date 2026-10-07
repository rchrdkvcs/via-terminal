use super::{
    input::SecretUpdate,
    model::{secret_id, Id, SecretKind, VaultData},
    Vault, DOCUMENT,
};
use crate::{error::AppResult, secrets::Secrets, storage::BlobChange};
use std::sync::atomic::Ordering;

pub(super) struct SecretChanges<'a> {
    secrets: &'a Secrets,
    blobs: Vec<BlobChange>,
}

impl SecretChanges<'_> {
    pub fn put(&mut self, kind: SecretKind, owner: Id, value: &[u8]) -> AppResult<()> {
        self.blobs
            .push(self.secrets.seal(&secret_id(kind, owner), value)?);
        Ok(())
    }

    pub fn update(&mut self, kind: SecretKind, owner: Id, update: &SecretUpdate) -> AppResult<()> {
        match update {
            SecretUpdate::Keep => Ok(()),
            SecretUpdate::Set(value) if !value.is_empty() => {
                self.put(kind, owner, value.as_bytes())
            }
            _ => {
                self.blobs.push(Secrets::removal(&secret_id(kind, owner)));
                Ok(())
            }
        }
    }

    pub fn forget(&mut self, owner: Id) {
        for kind in [
            SecretKind::Password,
            SecretKind::Passphrase,
            SecretKind::PrivateKey,
        ] {
            self.blobs.push(Secrets::removal(&secret_id(kind, owner)));
        }
    }
}

impl Vault {
    pub(crate) fn commit<T>(
        &self,
        change: impl FnOnce(&mut VaultData) -> AppResult<T>,
    ) -> AppResult<T> {
        self.commit_with_secrets(|data, _| change(data))
    }

    pub(super) fn commit_with_secrets<T>(
        &self,
        change: impl FnOnce(&mut VaultData, &mut SecretChanges<'_>) -> AppResult<T>,
    ) -> AppResult<T> {
        let mut data = self.data.lock().unwrap();
        let mut next = data.clone();
        let mut secrets = SecretChanges {
            secrets: &self.secrets,
            blobs: Vec::new(),
        };
        let result = change(&mut next, &mut secrets)?;
        self.storage
            .save_with_blobs(DOCUMENT, &next, &secrets.blobs)?;
        *data = next;
        self.revision.fetch_add(1, Ordering::Relaxed);
        Ok(result)
    }
}
