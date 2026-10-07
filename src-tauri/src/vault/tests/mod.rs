mod atomic_auth;
mod atomic_keys;
mod atomic_records;
mod connections;
mod credentials;
mod records;

use super::{input::*, model::*, Vault};
use crate::{
    secrets::{FixedKey, Secrets},
    storage::Storage,
};
use std::sync::Arc;

pub(super) fn vault() -> Vault {
    let storage = Arc::new(Storage::memory().unwrap());
    let secrets = Arc::new(Secrets::new(storage.clone(), &FixedKey(Some([3; 32]))));
    Vault::load(storage, secrets).unwrap()
}

pub(super) fn host(address: &str) -> HostInput {
    HostInput {
        own_credentials: false,
        id: None,
        group_id: None,
        label: String::new(),
        address: address.into(),
        overrides: Defaults::default(),
        key_id: None,
        tags: vec![],
        notes: String::new(),
        password: SecretUpdate::Keep,
    }
}

pub(super) fn failing_vault(
    sql: &str,
    key: Option<[u8; 32]>,
) -> (Vault, Arc<Storage>, Arc<Secrets>) {
    let connection = rusqlite::Connection::open_in_memory().unwrap();
    let storage = Arc::new(Storage::with_faults(connection, sql).unwrap());
    let secrets = Arc::new(Secrets::new(storage.clone(), &FixedKey(key)));
    let vault = Vault::load(storage.clone(), secrets.clone()).unwrap();
    (vault, storage, secrets)
}
