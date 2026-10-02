//! Vault behaviour through its public methods.

mod connections;
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
