use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub type Id = Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: Id,
    pub parent_id: Option<Id>,
    pub name: String,
    #[serde(default)]
    pub position: i64,
    #[serde(default)]
    pub defaults: Defaults,
}

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Defaults {
    pub username: Option<String>,
    pub port: Option<u16>,
    pub identity_id: Option<Id>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Host {
    #[serde(default)]
    pub own_credentials: bool,
    pub id: Id,
    pub group_id: Option<Id>,
    pub label: String,
    pub address: String,
    #[serde(default)]
    pub overrides: Defaults,
    pub key_id: Option<Id>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub created_at: i64,
    #[serde(default)]
    pub last_connected_at: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Identity {
    pub id: Id,
    pub label: String,
    pub username: String,
    pub key_id: Option<Id>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
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

#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultData {
    #[serde(default)]
    pub groups: Vec<Group>,
    #[serde(default)]
    pub hosts: Vec<Host>,
    #[serde(default)]
    pub identities: Vec<Identity>,
    #[serde(default)]
    pub keys: Vec<Key>,
    #[serde(default)]
    pub known_hosts: Vec<KnownHost>,
}

#[derive(Debug, Clone, Serialize)]
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
