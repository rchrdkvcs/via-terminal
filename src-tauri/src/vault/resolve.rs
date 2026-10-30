use super::model::{Host, Id, VaultData};
use serde::Serialize;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, TS)]
#[serde(tag = "kind", content = "id", rename_all = "camelCase")]
pub enum Source {
    Host,
    Identity(Id),
    Default,
}

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Sourced<T> {
    pub value: T,
    pub from: Source,
}

#[derive(Debug, Clone, PartialEq, Serialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct Effective {
    pub username: Option<Sourced<String>>,
    pub port: Sourced<u16>,
    pub identity_id: Option<Sourced<Id>>,
    pub key_id: Option<Sourced<Id>>,
}

pub fn effective(data: &VaultData, host: &Host) -> Effective {
    host.credential.resolve(data, host.port)
}
