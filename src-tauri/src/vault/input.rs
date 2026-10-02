//! What the interface may submit, and the rules a submission must satisfy
//! against the current vault before it is applied.

use super::model::{Defaults, Id, VaultData};
use crate::error::{AppError, AppResult};
use serde::Deserialize;

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(tag = "action", content = "value", rename_all = "camelCase")]
pub enum SecretUpdate {
    #[default]
    Keep,
    Clear,
    Set(String),
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HostInput {
    pub id: Option<Id>,
    pub group_id: Option<Id>,
    #[serde(default)]
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
    pub password: SecretUpdate,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GroupInput {
    pub id: Option<Id>,
    pub parent_id: Option<Id>,
    pub name: String,
    #[serde(default)]
    pub defaults: Defaults,
}

#[derive(Debug, Clone, Deserialize)]
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

#[derive(Debug, Clone, Deserialize)]
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

pub fn validate_defaults(data: &VaultData, defaults: &Defaults) -> AppResult<()> {
    if defaults.port == Some(0) {
        return Err(AppError::invalid(
            "le port doit être compris entre 1 et 65535",
        ));
    }
    if let Some(username) = &defaults.username {
        validate_username(username)?;
    }
    if let Some(id) = defaults.identity_id {
        if !data.identities.iter().any(|identity| identity.id == id) {
            return Err(AppError::not_found("identité"));
        }
    }
    Ok(())
}

pub fn validate_key_ref(data: &VaultData, key_id: Option<Id>) -> AppResult<()> {
    match key_id {
        Some(id) if !data.keys.iter().any(|key| key.id == id) => Err(AppError::not_found("clé")),
        _ => Ok(()),
    }
}

pub fn validate_group_ref(data: &VaultData, group_id: Option<Id>) -> AppResult<()> {
    match group_id {
        Some(id) if !data.groups.iter().any(|group| group.id == id) => {
            Err(AppError::not_found("groupe"))
        }
        _ => Ok(()),
    }
}

/// A group may not become its own ancestor.
pub fn validate_parent(data: &VaultData, group_id: Id, parent_id: Option<Id>) -> AppResult<()> {
    validate_group_ref(data, parent_id)?;
    let mut cursor = parent_id;
    while let Some(id) = cursor {
        if id == group_id {
            return Err(AppError::invalid(
                "un groupe ne peut pas être placé dans lui-même",
            ));
        }
        cursor = data
            .groups
            .iter()
            .find(|group| group.id == id)
            .and_then(|g| g.parent_id);
    }
    Ok(())
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
