mod connect;
mod connection_store;
mod credential;
mod mutation;
pub use connect::QuickTarget;
pub use credential::HostCredential;
mod groups;
mod hosts;
pub mod input;
mod keys;
pub mod model;
pub mod resolve;
#[cfg(test)]
mod tests;

use crate::{error::AppResult, secrets::Secrets, storage::Storage};
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
        let data = self.data.lock().unwrap();
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
                data: data.clone(),
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
}
