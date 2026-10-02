//! The vault: hosts, groups, identities, keys and known hosts, shared by every
//! space.
//!
//! Every mutation runs through [`Vault::commit`]: it validates against a copy,
//! persists the copy and only then replaces the in-memory data, so a failed
//! mutation never leaves a partial change behind. Secrets go to
//! [`crate::secrets`] and never appear in the persisted document.

mod connect;
pub use connect::QuickTarget;
mod groups;
mod hosts;
pub mod input;
mod keys;
pub mod model;
pub mod resolve;
#[cfg(test)]
mod tests;
mod trust;

use crate::{error::AppResult, secrets::Secrets, storage::Storage};
use input::SecretUpdate;
use model::{secret_id, Id, SecretKind, VaultData, VaultSnapshot};
use std::{
    collections::HashMap,
    sync::{Arc, Mutex},
};

const DOCUMENT: &str = "vault";

pub struct Vault {
    storage: Arc<Storage>,
    secrets: Arc<Secrets>,
    data: Mutex<VaultData>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultView {
    #[serde(flatten)]
    pub snapshot: VaultSnapshot,
    /// Effective values per host, with where each comes from.
    pub effective: HashMap<Id, resolve::Effective>,
}

impl Vault {
    pub fn load(storage: Arc<Storage>, secrets: Arc<Secrets>) -> AppResult<Self> {
        let data = storage.load(DOCUMENT)?.unwrap_or_default();
        Ok(Self {
            storage,
            secrets,
            data: Mutex::new(data),
        })
    }

    pub fn view(&self) -> AppResult<VaultView> {
        let data = self.data.lock().unwrap().clone();
        let has =
            |kind, id| -> AppResult<bool> { Ok(self.secrets.get(&secret_id(kind, id))?.is_some()) };
        let mut passwords = Vec::new();
        for id in data
            .hosts
            .iter()
            .map(|h| h.id)
            .chain(data.identities.iter().map(|i| i.id))
        {
            if has(SecretKind::Password, id)? {
                passwords.push(id);
            }
        }
        let mut passphrases = Vec::new();
        for key in &data.keys {
            if has(SecretKind::Passphrase, key.id)? {
                passphrases.push(key.id);
            }
        }
        let effective = data
            .hosts
            .iter()
            .map(|host| (host.id, resolve::effective(&data, host)))
            .collect();
        Ok(VaultView {
            snapshot: VaultSnapshot {
                data,
                passwords,
                passphrases,
                secrets_available: self.secrets.available(),
            },
            effective,
        })
    }

    pub(crate) fn read<T>(&self, read: impl FnOnce(&VaultData) -> T) -> T {
        read(&self.data.lock().unwrap())
    }

    /// Apply `change` to a copy, persist it, then publish it.
    pub(crate) fn commit<T>(
        &self,
        change: impl FnOnce(&mut VaultData) -> AppResult<T>,
    ) -> AppResult<T> {
        let mut data = self.data.lock().unwrap();
        let mut next = data.clone();
        let result = change(&mut next)?;
        self.storage.save(DOCUMENT, &next)?;
        *data = next;
        Ok(result)
    }

    pub(crate) fn update_secret(
        &self,
        kind: SecretKind,
        owner: Id,
        update: &SecretUpdate,
    ) -> AppResult<()> {
        match update {
            SecretUpdate::Keep => Ok(()),
            SecretUpdate::Clear => self.secrets.delete(&secret_id(kind, owner)),
            SecretUpdate::Set(value) if value.is_empty() => {
                self.secrets.delete(&secret_id(kind, owner))
            }
            SecretUpdate::Set(value) => self.secrets.put(&secret_id(kind, owner), value.as_bytes()),
        }
    }

    pub(crate) fn forget_secrets(&self, owner: Id) -> AppResult<()> {
        for kind in [
            SecretKind::Password,
            SecretKind::Passphrase,
            SecretKind::PrivateKey,
        ] {
            self.secrets.delete(&secret_id(kind, owner))?;
        }
        Ok(())
    }
}
