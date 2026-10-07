use super::{
    input::{self, HostInput},
    model::{now_ms, Defaults, Host, Id, SecretKind},
    Vault,
};
use crate::error::{AppError, AppResult};
use uuid::Uuid;

impl Vault {
    pub fn save_host(&self, input: HostInput) -> AppResult<Host> {
        let address = input.address.trim().to_string();
        input::validate_address(&address)?;
        let overrides = Defaults {
            username: input::trimmed(input.overrides.username),
            ..input.overrides
        };
        self.commit_with_secrets(|data, secrets| {
            input::validate_group_ref(data, input.group_id)?;
            input::validate_defaults(data, &overrides)?;
            input::validate_key_ref(data, input.key_id)?;
            let existing = input
                .id
                .map(|id| {
                    data.hosts
                        .iter()
                        .position(|host| host.id == id)
                        .ok_or_else(|| AppError::not_found("hôte"))
                })
                .transpose()?;
            let previous = existing.map(|index| data.hosts[index].clone());
            let host = Host {
                own_credentials: input.own_credentials,
                id: previous.as_ref().map_or_else(Uuid::new_v4, |host| host.id),
                group_id: input.group_id,
                label: input::trimmed(Some(input.label.clone())).unwrap_or_else(|| address.clone()),
                address: address.clone(),
                overrides: overrides.clone(),
                key_id: input.key_id,
                tags: input::clean_tags(input.tags.clone()),
                notes: input.notes.clone(),
                created_at: previous
                    .as_ref()
                    .map_or_else(now_ms, |host| host.created_at),
                last_connected_at: previous.and_then(|host| host.last_connected_at),
            };
            match existing {
                Some(index) => data.hosts[index] = host.clone(),
                None => data.hosts.push(host.clone()),
            }
            secrets.update(SecretKind::Password, host.id, &input.password)?;
            Ok(host)
        })
    }

    pub fn delete_host(&self, id: Id) -> AppResult<()> {
        self.commit_with_secrets(|data, secrets| {
            let before = data.hosts.len();
            data.hosts.retain(|host| host.id != id);
            if data.hosts.len() == before {
                return Err(AppError::not_found("hôte"));
            }
            secrets.forget(id);
            Ok(())
        })
    }

    pub fn duplicate_host(&self, id: Id) -> AppResult<Host> {
        self.commit(|data| {
            let index = data
                .hosts
                .iter()
                .position(|host| host.id == id)
                .ok_or_else(|| AppError::not_found("hôte"))?;
            let original = &data.hosts[index];
            let copy = Host {
                id: Uuid::new_v4(),
                label: format!("{} (copie)", original.label),
                created_at: now_ms(),
                last_connected_at: None,
                ..original.clone()
            };
            data.hosts.insert(index + 1, copy.clone());
            Ok(copy)
        })
    }
}
