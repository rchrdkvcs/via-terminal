use super::{
    credential::HostCredential,
    model::{Id, VaultData},
};
use crate::error::{AppError, AppResult};
use serde::Deserialize;
use ts_rs::TS;

#[derive(Debug, Clone, Default, Deserialize, TS)]
#[serde(tag = "action", content = "value", rename_all = "camelCase")]
pub enum SecretUpdate {
    #[default]
    Keep,
    Clear,
    Set(String),
}

#[derive(Debug, Clone, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct HostInput {
    pub id: Option<Id>,
    #[serde(default)]
    pub label: String,
    pub address: String,
    pub port: Option<u16>,
    #[serde(default)]
    pub credential: HostCredential,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub notes: String,
    #[serde(default)]
    pub password: SecretUpdate,
}

#[derive(Debug, Clone, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct IdentityInput {
    pub id: Option<Id>,
    #[serde(default)]
    pub label: String,
    pub username: String,
    pub key_id: Option<Id>,
    #[serde(default)]
    pub password: SecretUpdate,
}

#[derive(Debug, Clone, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct KeyImport {
    pub label: String,
    pub private_key: String,
    pub passphrase: Option<String>,
    #[serde(default)]
    pub remember_passphrase: bool,
}

pub fn validate_address(address: &str) -> AppResult<()> {
    let address = address.trim();
    if address.is_empty()
        || address.starts_with('-')
        || address.chars().any(|c| c.is_whitespace() || c.is_control())
    {
        return Err(AppError::invalid(
            "saisissez un nom d’hôte ou une adresse IP valide",
        ));
    }
    Ok(())
}

pub fn validate_username(username: &str) -> AppResult<()> {
    if username.chars().any(|c| c.is_control()) || username.starts_with('-') {
        return Err(AppError::invalid("saisissez un nom d’utilisateur valide"));
    }
    Ok(())
}

pub fn validate_port(port: Option<u16>) -> AppResult<()> {
    if port == Some(0) {
        return Err(AppError::invalid(
            "le port doit être compris entre 1 et 65535",
        ));
    }
    Ok(())
}

pub fn validate_key_ref(data: &VaultData, key_id: Option<Id>) -> AppResult<()> {
    match key_id {
        Some(id) if !data.keys.iter().any(|key| key.id == id) => Err(AppError::not_found("clé")),
        _ => Ok(()),
    }
}

pub fn clean_tags(tags: Vec<String>) -> Vec<String> {
    let mut clean: Vec<String> = Vec::new();
    for tag in tags.into_iter().map(|tag| tag.trim().to_string()) {
        if !tag.is_empty()
            && !clean
                .iter()
                .any(|existing| existing.eq_ignore_ascii_case(&tag))
        {
            clean.push(tag);
        }
    }
    clean
}

pub fn trimmed(value: Option<String>) -> Option<String> {
    value
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
}
