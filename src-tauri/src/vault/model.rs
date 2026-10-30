use super::{
    credential::HostCredential,
    legacy::{StoredHost, StoredVault},
};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

pub type Id = Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", from = "StoredHost")]
pub struct Host {
    pub id: Id,
    pub label: String,
    pub address: String,
    pub port: Option<u16>,
    pub credential: HostCredential,
    pub tags: Vec<String>,
    pub notes: String,
    pub created_at: i64,
    pub last_connected_at: Option<i64>,
}

impl From<StoredHost> for Host {
    fn from(stored: StoredHost) -> Self {
        stored.migrate(&[], &[])
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub id: Id,
    pub label: String,
    pub username: String,
    pub key_id: Option<Id>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Key {
    pub id: Id,
    pub label: String,
    pub algorithm: String,
    pub fingerprint: String,
    pub public_key: String,

    pub encrypted: bool,
    #[serde(default)]
    pub created_at: i64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct KnownHost {
    pub id: Id,
    pub address: String,
    pub port: u16,
    pub algorithm: String,
    pub fingerprint: String,
    #[serde(default)]
    pub added_at: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize, TS)]
#[serde(rename_all = "camelCase", from = "StoredVault")]
pub struct VaultData {
    #[serde(default)]
    pub hosts: Vec<Host>,
    #[serde(default)]
    pub identities: Vec<Identity>,
    #[serde(default)]
    pub keys: Vec<Key>,
    #[serde(default)]
    pub known_hosts: Vec<KnownHost>,
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct VaultSnapshot {
    #[serde(flatten)]
    pub data: VaultData,

    pub passwords: Vec<Id>,

    pub passphrases: Vec<Id>,
    pub secrets_available: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecretKind {
    Password,
    Passphrase,
    PrivateKey,
}

pub fn secret_id(kind: SecretKind, owner: Id) -> String {
    let prefix = match kind {
        SecretKind::Password => "password",
        SecretKind::Passphrase => "passphrase",
        SecretKind::PrivateKey => "private-key",
    };
    format!("{prefix}:{owner}")
}

pub fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or_default()
}
