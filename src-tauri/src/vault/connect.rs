use super::{
    input,
    model::{secret_id, Id, SecretKind, VaultData},
    resolve, Vault,
};
use crate::{
    error::{AppError, AppResult},
    sessions::ssh::{ConnectPlan, PlanKey},
};
use serde::Deserialize;
use ts_rs::TS;

#[derive(Debug, Clone, Deserialize, TS)]
#[serde(rename_all = "camelCase")]
pub struct QuickTarget {
    pub address: String,
    pub port: Option<u16>,
    pub username: Option<String>,
}

impl Vault {
    pub fn plan(&self, host_id: Id) -> AppResult<ConnectPlan> {
        self.read(|data| {
            let host = data
                .hosts
                .iter()
                .find(|h| h.id == host_id)
                .ok_or_else(|| AppError::not_found("hôte"))?;
            let effective = resolve::effective(data, host);
            let (key, password) =
                self.connection(data, Some(host.id), &host.credential, &effective)?;
            Ok(ConnectPlan {
                credential: None,
                host_id: Some(host.id),
                label: host.label.clone(),
                address: host.address.clone(),
                port: effective.port.value,
                username: effective.username.map(|sourced| sourced.value),
                key,
                password,
                can_remember: self.secrets.available(),
                save_host: false,
            })
        })
    }

    pub fn quick_plan(&self, target: QuickTarget, save_host: bool) -> AppResult<ConnectPlan> {
        let address = target.address.trim().to_string();
        input::validate_address(&address)?;
        let username = input::trimmed(target.username);
        if let Some(username) = &username {
            input::validate_username(username)?;
        }
        Ok(ConnectPlan {
            credential: None,
            host_id: None,
            label: address.clone(),
            address,
            port: target.port.filter(|port| *port != 0).unwrap_or(22),
            username,
            key: None,
            password: None,
            can_remember: save_host && self.secrets.available(),
            save_host,
        })
    }

    pub(super) fn plan_key(&self, data: &VaultData, key_id: Id) -> AppResult<PlanKey> {
        let label = data
            .keys
            .iter()
            .find(|k| k.id == key_id)
            .map(|k| k.label.clone())
            .ok_or_else(|| AppError::not_found("clé"))?;
        let private_key = self
            .secrets
            .get_string(&secret_id(SecretKind::PrivateKey, key_id))?
            .ok_or_else(|| {
                AppError::new("secrets_unavailable", "cette clé ne peut pas être lue")
            })?;
        Ok(PlanKey {
            id: key_id,
            label,
            private_key,
            passphrase: self
                .secrets
                .get_string(&secret_id(SecretKind::Passphrase, key_id))?,
        })
    }
}
